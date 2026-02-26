/**
 * renderer.js
 * Canvas描画モジュール（カメラ映像 + 骨格オーバーレイ）
 */
const Renderer = (() => {

  // 骨格の接続ペア（キーポイントインデックス）
  const SKELETON = [
    // 顔
    [0, 1], [0, 2], [1, 3], [2, 4],
    // 上半身
    [5, 6],   // 肩〜肩
    [5, 7],   // 左肩〜肘
    [7, 9],   // 左肘〜手首
    [6, 8],   // 右肩〜肘
    [8, 10],  // 右肘〜手首
    // 胴体
    [5, 11],  // 左肩〜左腰
    [6, 12],  // 右肩〜右腰
    [11, 12], // 腰〜腰
    // 下半身
    [11, 13], // 左腰〜左膝
    [13, 15], // 左膝〜左足首
    [12, 14], // 右腰〜右膝
    [14, 16], // 右膝〜右足首
  ];

  const MIN_SCORE = 0.3;
  const BONE_COLOR = 'rgba(0, 220, 255, 0.75)';
  const DOT_COLOR  = 'rgba(0, 220, 255, 0.95)';
  const BONE_WIDTH = 2.5;
  const DOT_RADIUS = 5;

  /**
   * 1フレーム分を描画する
   */
  function drawFrame(ctx, videoEl, keypoints, angles, exercise, W, H) {
    // Step1: カメラ映像をCanvasに描画
    ctx.drawImage(videoEl, 0, 0, W, H);

    if (!keypoints) return;

    // キーポイントをCanvas座標系にスケーリング
    const vW = videoEl.videoWidth  || W;
    const vH = videoEl.videoHeight || H;
    const sx = W / vW;
    const sy = H / vH;
    const scaled = keypoints.map(p => ({
      x: p.x * sx,
      y: p.y * sy,
      score: p.score,
    }));

    // Step2: 骨格ライン
    ctx.strokeStyle = BONE_COLOR;
    ctx.lineWidth = BONE_WIDTH;
    ctx.lineCap = 'round';
    for (const [i, j] of SKELETON) {
      const a = scaled[i], b = scaled[j];
      if (!a || !b || a.score < MIN_SCORE || b.score < MIN_SCORE) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Step3: 関節ドット
    ctx.fillStyle = DOT_COLOR;
    for (const p of scaled) {
      if (p.score < MIN_SCORE) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    // Step4: 角度ラベル
    if (angles) {
      drawAngles(ctx, angles, exercise, sx, sy);
    }
  }

  function drawAngles(ctx, angles, exercise, sx, sy) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const angle of Object.values(angles)) {
      if (!angle.pos || angle.value === null) continue;

      const x = angle.pos.x * sx;
      const y = angle.pos.y * sy;

      // ラベルをドットの上に配置
      const labelX = x;
      const labelY = y - 22;

      const text = `${angle.label} ${angle.value}°`;
      const color = AngleCalculator.getColor(exercise, angle.key, angle.value);

      // 背景（可読性向上）
      ctx.font = 'bold 14px -apple-system, sans-serif';
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(labelX - tw / 2 - 4, labelY - 9, tw + 8, 18);

      // テキスト
      ctx.fillStyle = color;
      ctx.fillText(text, labelX, labelY);
    }
  }

  return { drawFrame };
})();
