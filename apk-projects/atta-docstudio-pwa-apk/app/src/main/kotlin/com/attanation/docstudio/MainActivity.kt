package com.attanation.docstudio

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.KeyguardManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.fragment.app.FragmentActivity
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

class MainActivity : FragmentActivity() {

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val START_URL = "https://$APP_HOST/index.html"
        private const val DOWNLOAD_SUBFOLDER = "ATTA DocStudio Pro"
    }

    private data class PendingSave(
        val file: File,
        val fileName: String,
        val mimeType: String,
        val stream: BufferedOutputStream
    )

    private lateinit var rootLayout: FrameLayout
    private lateinit var webView: WebView
    private val pendingSaves = ConcurrentHashMap<String, PendingSave>()
    private val ocrExecutor = Executors.newSingleThreadExecutor()

    private var pendingPermissionRequest: PermissionRequest? = null
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraUri: Uri? = null
    private var pendingCameraFile: File? = null
    private var pendingFileChooserParams: WebChromeClient.FileChooserParams? = null
    private var waitingCameraForFileChooser = false

    private val mlkitScannerLauncher =
        registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val scanResult = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
                val pages = scanResult?.pages
                if (pages.isNullOrEmpty()) {
                    dispatchDocumentScanFallback("empty")
                    return@registerForActivityResult
                }
                val scanDir = File(cacheDir, "mlkit_scans").apply { mkdirs() }
                val urls = JSONArray()
                for (page in pages) {
                    runCatching {
                        val fileName = "${UUID.randomUUID()}.jpg"
                        val outFile = File(scanDir, fileName)
                        contentResolver.openInputStream(page.imageUri)?.use { input ->
                            FileOutputStream(outFile).use { output -> input.copyTo(output) }
                        }
                        if (outFile.exists() && outFile.length() > 0L) {
                            urls.put("https://$APP_HOST/__mlkit_scan/$fileName")
                        }
                    }
                }
                if (urls.length() > 0) {
                    dispatchDocumentScanResult(urls.toString())
                } else {
                    dispatchDocumentScanFallback("copy_failed")
                }
            } else {
                dispatchDocumentScanFallback("cancelled")
            }
        }

    private val cameraPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            pendingPermissionRequest?.let { req ->
                if (granted) {
                    req.grant(req.resources)
                } else {
                    req.deny()
                    Toast.makeText(
                        this,
                        "Izin kamera diperlukan untuk pemindaian langsung.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
                pendingPermissionRequest = null
            }

            if (waitingCameraForFileChooser) {
                waitingCameraForFileChooser = false
                if (granted) {
                    launchCameraForFileChooser()
                } else {
                    Toast.makeText(
                        this,
                        "Izin kamera ditolak. Memilih dari galeri sebagai alternatif.",
                        Toast.LENGTH_SHORT
                    ).show()
                    launchDocumentPicker(pendingFileChooserParams)
                }
            }
        }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = pendingFileCallback
            val cameraUri = pendingCameraUri
            val cameraFile = pendingCameraFile
            pendingFileCallback = null
            pendingCameraUri = null
            pendingCameraFile = null
            pendingFileChooserParams = null

            if (callback == null) return@registerForActivityResult

            if (result.resultCode != RESULT_OK) {
                cameraFile?.delete()
                callback.onReceiveValue(null)
                return@registerForActivityResult
            }

            val uris = mutableListOf<Uri>()
            val data = result.data
            if (data != null) {
                val clip = data.clipData
                if (clip != null && clip.itemCount > 0) {
                    for (i in 0 until clip.itemCount) {
                        clip.getItemAt(i)?.uri?.let { uris.add(it) }
                    }
                } else if (data.data != null) {
                    data.data?.let { uris.add(it) }
                }
            }
            if (uris.isEmpty() && cameraUri != null && cameraFile != null && cameraFile.exists() && cameraFile.length() > 0L) {
                uris.add(cameraUri)
            }

            callback.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)

        rootLayout = FrameLayout(this)
        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        applySystemBarColors(isDark = false)

        rootLayout.addView(webView)
        setContentView(rootLayout)

        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { v, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()
            )
            v.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        configureWebView()
        setupBackNavigation()

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    private fun applySystemBarColors(isDark: Boolean) {
        val statusColor = Color.parseColor(if (isDark) "#12161B" else "#DCE2E7")
        val navColor = Color.parseColor(if (isDark) "#1D232B" else "#FFFFFF")
        @Suppress("DEPRECATION")
        window.statusBarColor = statusColor
        @Suppress("DEPRECATION")
        window.navigationBarColor = navColor
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isDark
            isAppearanceLightNavigationBars = !isDark
        }
        if (::rootLayout.isInitialized) {
            rootLayout.setBackgroundColor(statusColor)
        }
        if (::webView.isInitialized) {
            webView.setBackgroundColor(statusColor)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.addJavascriptInterface(AttaNativeBridge(), "AttaNativeAndroid")

        webView.setDownloadListener { url, _, _, _, _ ->
            if (!url.isNullOrBlank() && (url.startsWith("https://") || url.startsWith("http://"))) {
                openExternalUri(Uri.parse(url))
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val uri = request?.url ?: return null
                if (!"https".equals(uri.scheme, ignoreCase = true) ||
                    !APP_HOST.equals(uri.host, ignoreCase = true)
                ) {
                    return null
                }
                val reqPath = uri.path ?: ""
                if (reqPath.startsWith("/__mlkit_scan/")) {
                    return serveMlkitScanFile(reqPath.removePrefix("/__mlkit_scan/"))
                }
                return serveBundledAsset(reqPath)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                if ("https".equals(uri.scheme, ignoreCase = true) &&
                    APP_HOST.equals(uri.host, ignoreCase = true)
                ) {
                    return false
                }
                openExternalUri(uri)
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                runOnUiThread {
                    val wantsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                    if (!wantsCamera) {
                        request.deny()
                        return@runOnUiThread
                    }
                    val granted = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED
                    if (granted) {
                        request.grant(request.resources)
                    } else {
                        pendingPermissionRequest?.deny()
                        pendingPermissionRequest = request
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (filePathCallback == null) return false
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback
                pendingFileChooserParams = fileChooserParams

                if (fileChooserParams?.isCaptureEnabled == true) {
                    val granted = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED
                    if (granted) {
                        launchCameraForFileChooser()
                    } else {
                        waitingCameraForFileChooser = true
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                    }
                } else {
                    launchDocumentPicker(fileChooserParams)
                }
                return true
            }
        }
    }

    private fun setupBackNavigation() {
        val backCallback = object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                    return
                }
                webView.evaluateJavascript(
                    "(function(){ if(typeof handleNativeBackPressed==='function'){ return handleNativeBackPressed() ? '1' : '0'; } var o = document.querySelector('.sheet-backdrop.show'); if(o){ if(typeof dismissBackdropElement==='function'){dismissBackdropElement(o);}else{o.classList.remove('show');} return '1'; } return '0'; })()"
                ) { result ->
                    if (result != "\"1\"") {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        }
        onBackPressedDispatcher.addCallback(this, backCallback)
    }

    private fun serveBundledAsset(rawPath: String?): WebResourceResponse {
        val normalized = (rawPath ?: "/").trimStart('/').ifEmpty { "index.html" }
        if (normalized.split('/').any { it == ".." }) {
            return WebResourceResponse(
                "text/plain",
                "utf-8",
                403,
                "Forbidden",
                emptyMap(),
                ByteArrayInputStream(ByteArray(0))
            )
        }

        return try {
            val stream = assets.open("www/$normalized")
            val (mime, encoding) = detectMimeAndEncoding(normalized)
            val headers = mapOf(
                "Access-Control-Allow-Origin" to "*",
                "Cache-Control" to "no-store"
            )
            WebResourceResponse(mime, encoding, 200, "OK", headers, stream)
        } catch (_: IOException) {
            WebResourceResponse(
                "text/plain",
                "utf-8",
                404,
                "Not Found",
                emptyMap(),
                ByteArrayInputStream(ByteArray(0))
            )
        }
    }

    private fun detectMimeAndEncoding(path: String): Pair<String, String?> {
        val ext = path.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return when (ext) {
            "html", "htm" -> "text/html" to "utf-8"
            "css" -> "text/css" to "utf-8"
            "js", "mjs" -> "application/javascript" to "utf-8"
            "json", "webmanifest" -> "application/json" to "utf-8"
            "svg" -> "image/svg+xml" to "utf-8"
            "txt", "md" -> "text/plain" to "utf-8"
            "wasm" -> "application/wasm" to null
            "png" -> "image/png" to null
            "jpg", "jpeg" -> "image/jpeg" to null
            "webp" -> "image/webp" to null
            "ico" -> "image/x-icon" to null
            "woff2" -> "font/woff2" to null
            "woff" -> "font/woff" to null
            "ttf" -> "font/ttf" to null
            "otf" -> "font/otf" to null
            "pfb", "bcmap" -> "application/octet-stream" to null
            else -> "application/octet-stream" to null
        }
    }

    private fun launchCameraForFileChooser() {
        try {
            val captureDir = File(cacheDir, "camera_captures").apply { mkdirs() }
            captureDir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(8)?.forEach { it.delete() }
            val photoFile = File(captureDir, "scan_${System.currentTimeMillis()}.jpg")
            val photoUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", photoFile)
            pendingCameraFile = photoFile
            pendingCameraUri = photoUri

            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                clipData = ClipData.newRawUri("", photoUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
            fileChooserLauncher.launch(intent)
        } catch (_: Exception) {
            pendingCameraFile = null
            pendingCameraUri = null
            launchDocumentPicker(pendingFileChooserParams)
        }
    }

    private fun launchDocumentPicker(params: WebChromeClient.FileChooserParams?) {
        try {
            val mimeTypes = mapAcceptTypesToMimeTypes(params?.acceptTypes)
            val allowMultiple = params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                if (allowMultiple) {
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                if (mimeTypes.size == 1) {
                    type = mimeTypes[0]
                } else {
                    type = "*/*"
                    if (mimeTypes.isNotEmpty()) {
                        putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
                    }
                }
            }
            fileChooserLauncher.launch(intent)
        } catch (_: Exception) {
            pendingFileCallback?.onReceiveValue(null)
            pendingFileCallback = null
            pendingCameraUri = null
            pendingCameraFile = null
            pendingFileChooserParams = null
            Toast.makeText(this, "Tidak bisa membuka pemilih berkas di perangkat ini.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun mapAcceptTypesToMimeTypes(acceptTypes: Array<String>?): Array<String> {
        if (acceptTypes.isNullOrEmpty()) return emptyArray()
        val mimes = linkedSetOf<String>()
        var addOctetStream = false

        for (raw in acceptTypes) {
            for (token in raw.split(',')) {
                val item = token.trim().lowercase(Locale.ROOT)
                if (item.isEmpty()) continue
                when (item) {
                    "*/*" -> return emptyArray()
                    ".pdf" -> mimes.add("application/pdf")
                    ".jpg", ".jpeg" -> mimes.add("image/jpeg")
                    ".png" -> mimes.add("image/png")
                    ".webp" -> mimes.add("image/webp")
                    ".txt" -> mimes.add("text/plain")
                    ".csv" -> {
                        mimes.add("text/csv")
                        mimes.add("text/comma-separated-values")
                        mimes.add("application/csv")
                    }
                    ".md" -> {
                        mimes.add("text/markdown")
                        mimes.add("text/plain")
                        addOctetStream = true
                    }
                    ".json" -> {
                        mimes.add("application/json")
                        mimes.add("text/plain")
                        addOctetStream = true
                    }
                    ".zip" -> {
                        mimes.add("application/zip")
                        mimes.add("application/x-zip-compressed")
                        addOctetStream = true
                    }
                    ".docx" -> {
                        mimes.add("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                        addOctetStream = true
                    }
                    ".xlsx" -> {
                        mimes.add("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                        addOctetStream = true
                    }
                    else -> {
                        if (item.contains('/')) {
                            mimes.add(item)
                        }
                    }
                }
            }
        }
        if (addOctetStream && mimes.isNotEmpty()) {
            mimes.add("application/octet-stream")
        }
        return mimes.toTypedArray()
    }

    private fun openExternalUri(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, "Tidak ada aplikasi untuk membuka tautan ini.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun sanitizeFileName(name: String?): String {
        val raw = (name ?: "").trim().ifEmpty { "dokumen" }
        val clean = raw.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]+"), "_").trim()
        return clean.ifEmpty { "dokumen" }
    }

    private fun saveTempFileToDownloads(sourceFile: File, fileName: String, mimeType: String): Boolean {
        val safeName = sanitizeFileName(fileName)
        val cleanMime = mimeType.ifBlank { "application/octet-stream" }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                put(MediaStore.Downloads.MIME_TYPE, cleanMime)
                put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$DOWNLOAD_SUBFOLDER")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = contentResolver
            val itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
            return try {
                resolver.openOutputStream(itemUri)?.use { out ->
                    FileInputStream(sourceFile).use { input ->
                        input.copyTo(out)
                    }
                } ?: throw IOException("Gagal membuka stream tujuan")
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(itemUri, values, null, null)
                true
            } catch (_: Exception) {
                resolver.delete(itemUri, null, null)
                false
            }
        }

        val canWritePublic = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        ) == PackageManager.PERMISSION_GRANTED

        val targetDir = if (canWritePublic) {
            @Suppress("DEPRECATION")
            File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), DOWNLOAD_SUBFOLDER)
        } else {
            File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), DOWNLOAD_SUBFOLDER)
        }
        targetDir.mkdirs()

        var outFile = File(targetDir, safeName)
        if (outFile.exists()) {
            val dot = safeName.lastIndexOf('.')
            val base = if (dot > 0) safeName.substring(0, dot) else safeName
            val ext = if (dot > 0) safeName.substring(dot) else ""
            outFile = File(targetDir, "${base}_${System.currentTimeMillis()}$ext")
        }

        FileInputStream(sourceFile).use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        }
        MediaScannerConnection.scanFile(this, arrayOf(outFile.absolutePath), arrayOf(cleanMime), null)
        return true
    }

    private fun shareTempFile(sourceFile: File, fileName: String, mimeType: String): Boolean {
        val safeName = sanitizeFileName(fileName)
        val cleanMime = mimeType.ifBlank { "application/octet-stream" }
        val shareDir = File(cacheDir, "shared_exports").apply { mkdirs() }
        shareDir.listFiles()?.sortedByDescending { it.lastModified() }?.drop(5)?.forEach { it.delete() }

        val shareFile = File(shareDir, safeName)
        FileInputStream(sourceFile).use { input ->
            FileOutputStream(shareFile).use { output ->
                input.copyTo(output)
            }
        }

        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", shareFile)
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = cleanMime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, safeName)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            clipData = ClipData.newUri(contentResolver, safeName, uri)
        }
        runOnUiThread {
            try {
                startActivity(Intent.createChooser(sendIntent, "Bagikan berkas"))
            } catch (_: Exception) {
                Toast.makeText(this@MainActivity, "Tidak ada aplikasi penerima.", Toast.LENGTH_SHORT).show()
            }
        }
        return true
    }

    inner class AttaNativeBridge {
        @JavascriptInterface
        fun isNativeAndroid(): Boolean = true

        @JavascriptInterface
        fun getAppVersion(): String {
            return try {
                packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0.0"
            } catch (_: Exception) {
                "1.0.0"
            }
        }

        @JavascriptInterface
        fun setSystemBars(isDark: Boolean) {
            runOnUiThread {
                applySystemBarColors(isDark)
            }
        }

        @JavascriptInterface
        fun isBiometricAvailable(): Boolean {
            val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.BIOMETRIC_WEAK
            return BiometricManager.from(this@MainActivity).canAuthenticate(authenticators) ==
                BiometricManager.BIOMETRIC_SUCCESS
        }

        @JavascriptInterface
        fun isDeviceOrBiometricAvailable(): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.BIOMETRIC_WEAK or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
                BiometricManager.from(this@MainActivity).canAuthenticate(authenticators) ==
                    BiometricManager.BIOMETRIC_SUCCESS
            } else {
                val km = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
                (km?.isDeviceSecure == true) || isBiometricAvailable()
            }
        }

        @JavascriptInterface
        fun authenticateBiometric(title: String?, subtitle: String?, cancelLabel: String?) {
            runOnUiThread {
                val executor = ContextCompat.getMainExecutor(this@MainActivity)
                val prompt = BiometricPrompt(
                    this@MainActivity,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            dispatchBiometricCallback(true, "")
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            dispatchBiometricCallback(false, errString.toString())
                        }

                        override fun onAuthenticationFailed() {
                            // BiometricPrompt menangani retry sampai gagal final
                        }
                    }
                )
                val info = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title?.takeIf { it.isNotBlank() } ?: "Buka ATTA DocStudio Pro")
                    .setSubtitle(subtitle?.takeIf { it.isNotBlank() } ?: "Gunakan sidik jari atau wajah")
                    .setNegativeButtonText(cancelLabel?.takeIf { it.isNotBlank() } ?: "Pakai kunci cadangan")
                    .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG or
                            BiometricManager.Authenticators.BIOMETRIC_WEAK
                    )
                    .build()
                try {
                    prompt.authenticate(info)
                } catch (e: Exception) {
                    dispatchBiometricCallback(false, e.message ?: "Biometric tidak tersedia")
                }
            }
        }

        @JavascriptInterface
        fun authenticateWithDeviceCredential(title: String?, subtitle: String?) {
            runOnUiThread {
                val executor = ContextCompat.getMainExecutor(this@MainActivity)
                val prompt = BiometricPrompt(
                    this@MainActivity,
                    executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            dispatchBiometricCallback(true, "")
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            dispatchBiometricCallback(false, errString.toString())
                        }

                        override fun onAuthenticationFailed() {}
                    }
                )
                val builder = BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title?.takeIf { it.isNotBlank() } ?: "Verifikasi pemilik HP")
                    .setSubtitle(subtitle?.takeIf { it.isNotBlank() } ?: "Gunakan Face Key, sidik jari, atau kunci layar HP")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    builder.setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG or
                            BiometricManager.Authenticators.BIOMETRIC_WEAK or
                            BiometricManager.Authenticators.DEVICE_CREDENTIAL
                    )
                } else {
                    @Suppress("DEPRECATION")
                    builder.setDeviceCredentialAllowed(true)
                }
                try {
                    prompt.authenticate(builder.build())
                } catch (e: Exception) {
                    dispatchBiometricCallback(false, e.message ?: "Kunci perangkat tidak tersedia")
                }
            }
        }

        @JavascriptInterface
        fun recognizeTextFromImage(base64OrDataUrl: String?, callbackId: String?) {
            val cbId = callbackId ?: ""
            if (base64OrDataUrl.isNullOrBlank()) {
                dispatchOcrCallback(cbId, JSONObject().put("text", "").put("paragraphs", JSONArray()).put("lines", JSONArray()).toString())
                return
            }
            ocrExecutor.execute {
                val payload = JSONObject()
                var bitmap: android.graphics.Bitmap? = null
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                try {
                    val commaIdx = base64OrDataUrl.indexOf(',')
                    val pureB64 = if (commaIdx >= 0) base64OrDataUrl.substring(commaIdx + 1) else base64OrDataUrl
                    val bytes = Base64.decode(pureB64, Base64.DEFAULT)
                    bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    if (bitmap == null || bitmap.width <= 0 || bitmap.height <= 0) {
                        payload.put("text", "").put("paragraphs", JSONArray()).put("lines", JSONArray())
                        dispatchOcrCallback(cbId, payload.toString())
                        return@execute
                    }
                    val imgW = bitmap.width.toDouble()
                    val imgH = bitmap.height.toDouble()
                    val image = InputImage.fromBitmap(bitmap, 0)
                    recognizer.process(image)
                        .addOnSuccessListener { visionText ->
                            val paragraphs = JSONArray()
                            val linesArr = JSONArray()
                            for (block in visionText.textBlocks) {
                                paragraphs.put(block.text)
                                for (line in block.lines) {
                                    val box = line.boundingBox
                                    val lineObj = JSONObject().put("text", line.text)
                                    if (box != null) {
                                        lineObj.put("x", box.left / imgW)
                                        lineObj.put("y", box.top / imgH)
                                        lineObj.put("w", box.width() / imgW)
                                        lineObj.put("h", box.height() / imgH)
                                    }
                                    linesArr.put(lineObj)
                                }
                            }
                            payload.put("text", visionText.text)
                            payload.put("paragraphs", paragraphs)
                            payload.put("lines", linesArr)
                            dispatchOcrCallback(cbId, payload.toString())
                            recognizer.close()
                            bitmap?.recycle()
                        }
                        .addOnFailureListener {
                            payload.put("text", "").put("paragraphs", JSONArray()).put("lines", JSONArray())
                            dispatchOcrCallback(cbId, payload.toString())
                            recognizer.close()
                            bitmap?.recycle()
                        }
                } catch (_: Exception) {
                    payload.put("text", "").put("paragraphs", JSONArray()).put("lines", JSONArray())
                    dispatchOcrCallback(cbId, payload.toString())
                    recognizer.close()
                    bitmap?.recycle()
                }
            }
        }

        @JavascriptInterface
        fun copyText(text: String?): Boolean {
            if (text == null) return false
            return try {
                runOnUiThread {
                    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                    cm?.setPrimaryClip(ClipData.newPlainText("ATTA DocStudio Pro", text))
                }
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun beginFileSave(fileName: String?, mimeType: String?): String {
            return try {
                val token = UUID.randomUUID().toString()
                val dir = File(cacheDir, "pending_saves").apply { mkdirs() }
                val file = File(dir, token)
                val stream = BufferedOutputStream(FileOutputStream(file, false), 65536)
                pendingSaves[token] = PendingSave(
                    file = file,
                    fileName = sanitizeFileName(fileName),
                    mimeType = (mimeType ?: "").ifBlank { "application/octet-stream" },
                    stream = stream
                )
                token
            } catch (_: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun appendFileChunk(token: String?, base64Chunk: String?): Boolean {
            val session = if (token != null) pendingSaves[token] else null
            if (session == null || base64Chunk == null) return false
            return try {
                val bytes = Base64.decode(base64Chunk, Base64.DEFAULT)
                session.stream.write(bytes)
                true
            } catch (_: Exception) {
                pendingSaves.remove(token)
                runCatching { session.stream.close() }
                session.file.delete()
                false
            }
        }

        @JavascriptInterface
        fun finishFileSave(token: String?, shareAfterSave: Boolean): Boolean {
            val session = token?.let { pendingSaves.remove(it) } ?: return false
            return try {
                session.stream.flush()
                session.stream.close()
                if (shareAfterSave) {
                    shareTempFile(session.file, session.fileName, session.mimeType)
                } else {
                    saveTempFileToDownloads(session.file, session.fileName, session.mimeType)
                }
            } catch (_: Exception) {
                false
            } finally {
                session.file.delete()
            }
        }

        @JavascriptInterface
        fun saveFile(
            base64Data: String?,
            fileName: String?,
            mimeType: String?,
            shareAfterSave: Boolean
        ): Boolean {
            if (base64Data == null) return false
            val token = beginFileSave(fileName, mimeType)
            if (token.isEmpty()) return false
            if (!appendFileChunk(token, base64Data)) return false
            return finishFileSave(token, shareAfterSave)
        }

        @JavascriptInterface
        fun startDocumentScanner(maxPages: Int) {
            val clampedPages = maxPages.coerceIn(1, 50)
            runOnUiThread {
                runCatching {
                    val options = GmsDocumentScannerOptions.Builder()
                        .setGalleryImportAllowed(true)
                        .setPageLimit(clampedPages)
                        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
                        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                        .build()
                    val scanner = GmsDocumentScanning.getClient(options)
                    scanner.getStartScanIntent(this@MainActivity)
                        .addOnSuccessListener { intentSender ->
                            mlkitScannerLauncher.launch(IntentSenderRequest.Builder(intentSender).build())
                        }
                        .addOnFailureListener { e ->
                            dispatchDocumentScanFallback(e.message ?: "unavailable")
                        }
                }.onFailure { e ->
                    dispatchDocumentScanFallback(e.message ?: "unavailable")
                }
            }
        }
    }

    private fun serveMlkitScanFile(rawName: String): WebResourceResponse? {
        val safeName = rawName.trim().substringBefore('?').substringBefore('#')
        if (safeName.isEmpty() || safeName.contains('/') || safeName.contains('\\') || safeName.contains("..")) {
            return null
        }
        return runCatching {
            val scanDir = File(cacheDir, "mlkit_scans").canonicalFile
            val target = File(scanDir, safeName).canonicalFile
            if (!target.path.startsWith(scanDir.path + File.separator) || !target.isFile) {
                return null
            }
            WebResourceResponse("image/jpeg", null, FileInputStream(target))
        }.getOrNull()
    }

    private fun dispatchDocumentScanResult(urlsJson: String) {
        val js = "window.__onAttaDocumentScanResult && window.__onAttaDocumentScanResult($urlsJson);"
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(js, null)
            }
        }
    }

    private fun dispatchDocumentScanFallback(reason: String) {
        val js = "window.__onAttaDocumentScanFallback && window.__onAttaDocumentScanFallback(${JSONObject.quote(reason)});"
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(js, null)
            }
        }
    }

    private fun dispatchBiometricCallback(success: Boolean, message: String) {
        val js = "window.__onAttaBiometricResult && window.__onAttaBiometricResult(${if (success) "true" else "false"}, ${JSONObject.quote(message)});"
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(js, null)
            }
        }
    }

    private fun dispatchOcrCallback(callbackId: String, jsonPayload: String) {
        val js = "window.__onAttaOcrResult && window.__onAttaOcrResult(${JSONObject.quote(callbackId)}, ${JSONObject.quote(jsonPayload)});"
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(js, null)
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        ocrExecutor.shutdownNow()
        runCatching { File(cacheDir, "mlkit_scans").deleteRecursively() }
        pendingSaves.values.forEach {
            runCatching { it.stream.close() }
            it.file.delete()
        }
        pendingSaves.clear()
        webView.destroy()
        super.onDestroy()
    }
}
