/**
 * Memuat pdf.js (lokal, offline) lalu menaruhnya di window.pdfjsLib.
 * Dipakai untuk thumbnail halaman asli, membaca teks PDF, dan redaksi permanen.
 */
import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
window.pdfjsLib = pdfjsLib;
window.dispatchEvent(new Event('pdfjs-ready'));
