/**
 * recorder.js
 * canvas.captureStream() を使った動画録画・保存モジュール
 */
const Recorder = (() => {

  let mediaRecorder = null;
  let chunks = [];
  let timerInterval = null;

  /**
   * iOS SafariでサポートされるMIMEタイプを返す
   */
  function getSupportedMimeType() {
    const candidates = [
      'video/mp4;codecs=avc1',   // iOS Safari 優先
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return ''; // ブラウザのデフォルトに任せる
  }

  /**
   * 録画開始
   * @param {HTMLCanvasElement} canvas - 録画元Canvas
   * @param {Function} onTimer - 経過時間文字列(MM:SS)を受け取るコールバック
   * @param {number} fps - キャプチャFPS（デフォルト30）
   */
  function startRecording(canvas, onTimer, fps = 30) {
    chunks = [];

    const stream = canvas.captureStream(fps);
    const mimeType = getSupportedMimeType();

    const options = { videoBitsPerSecond: 4_000_000 }; // 4Mbps
    if (mimeType) options.mimeType = mimeType;

    mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    // 100msごとにデータを収集（途中でメモリを解放しながら録画）
    mediaRecorder.start(100);

    // タイマー開始
    const startTime = Date.now();
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      onTimer(`${m}:${s}`);
    }, 1000);
  }

  /**
   * 録画停止・ファイル保存
   * @param {string} exercise - エクササイズ名（ファイル名に使用）
   * @returns {Promise<void>}
   */
  function stopRecording(exercise) {
    return new Promise((resolve) => {
      clearInterval(timerInterval);

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve();
        return;
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'video/mp4';
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        // iPhoneでのダウンロードトリガー
        const a = document.createElement('a');
        const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        a.href = url;
        a.download = `${exercise}_${ts}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // メモリ解放（少し遅延させてダウンロード完了を待つ）
        setTimeout(() => URL.revokeObjectURL(url), 15000);
        chunks = [];
        resolve();
      };

      mediaRecorder.stop();
    });
  }

  function isRecording() {
    return mediaRecorder !== null && mediaRecorder.state === 'recording';
  }

  return { startRecording, stopRecording, isRecording };
})();
