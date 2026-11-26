import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'core/services/app_preferences.dart';
import 'core/theme/app_theme.dart';
import 'views/main_navigation_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppPreferences.instance.load();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const AttaDocStudioApp());
}

class AttaDocStudioApp extends StatelessWidget {
  const AttaDocStudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: AppPreferences.instance,
      builder: (context, _) {
        final prefs = AppPreferences.instance;
        return MaterialApp(
          title: 'ATTA DocStudio Pro',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: prefs.themeMode,
          home: const MainNavigationShell(),
        );
      },
    );
  }
}
