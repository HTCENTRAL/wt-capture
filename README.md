# ウエイトトレーニング モーションキャプチャ PWA

## 概要

iPhoneのカメラを使い、ウエイトトレーニングの動作を録画しながら
関節の骨格ライン・角度をリアルタイムでオーバーレイ表示するWebアプリ。
骨格オーバーレイ入りの動画をiPhone本体に保存できる。

**アクセスURL:** https://HTCENTRAL.github.io/wt-capture/

---

## 対応エクササイズと表示される角度

| エクササイズ | 表示角度 |
|---|---|
| スクワット | 左右膝角度・股関節屈曲・背中の傾き |
| デッドリフト | 股関節ヒンジ・膝角度・背中の傾き |
| ブルガリアンスクワット | 前後膝角度・股関節屈曲・体幹傾き |

**角度の色分け:**
- 🟢 緑 = 適正範囲
- 🟡 黄 = 注意
- 🔴 赤 = 範囲外
- ⚫ グレー = 検出不可

---

## 使い方

1. iPhoneのSafariで上記URLを開く
2. カメラの使用を「許可」
3. エクササイズを選択
4. iPhoneをスタンドなどで固定（全身が映る位置・2〜3m推奨）
5. **REC** をタップ → 離れて動作を実施（映り込んだ瞬間から骨格表示）
6. **STOP** → 動画がiPhoneに自動保存

---

## 技術スタック

### なぜWebアプリ（PWA）か
- 開発環境がWindowsのみ → iOSネイティブ開発にはMac + Xcodeが必要
- GitHub Pagesで無料ホスティング → HTTPS対応（カメラ権限に必須）
- ビルド環境不要・CDNのみで動作

### 使用ライブラリ（CDN読み込み・バージョン固定）
| ライブラリ | バージョン | 用途 |
|---|---|---|
| @tensorflow/tfjs | 4.17.0 | AI推論エンジン（WebGLバックエンド） |
| @tensorflow-models/pose-detection | 2.1.3 | MoveNet姿勢推定モデル |

### モデル選択理由
**MoveNet SINGLEPOSE_LIGHTNING** を使用
- 最軽量・最速のモデル（モバイル向け）
- iPhoneで実用的なフレームレートで動作

---

## ファイル構成

```
weight_training/
├── index.html               # メインHTML（2画面構成・CDN読み込み順定義）
├── style.css                # UI（ランドスケープ/ポートレート両対応・iPhoneセーフエリア）
├── manifest.json            # PWAマニフェスト（フルスクリーン・横向き設定）
├── README.md                # このファイル
└── js/
    ├── angle-calculator.js  # 関節角度計算（3点ベクトル法）
    ├── pose-detector.js     # MoveNetラッパー（Promise.then形式）
    ├── renderer.js          # Canvas描画（骨格ライン・角度ラベル）
    ├── recorder.js          # MediaRecorder・動画保存（iOS対応MIMEタイプ）
    └── app.js               # メイン制御（カメラ・アニメーションループ・UI）
```

### 各ファイルの役割

#### `angle-calculator.js`
- **`angleBetween(A, B, C)`** … B点での角度を返す（0〜180度）
- **`angleFromVertical(A, B)`** … 垂直からの傾き角度を返す
- **`getAngles(keypoints, exercise)`** … エクササイズごとの角度セットを返す
- **`getColor(exercise, key, value)`** … 角度値に応じた色（緑/黄/赤）を返す

#### `pose-detector.js`
- TF.js WebGLバックエンドの初期化
- MoveNetモデルのロード（`'SinglePose.Lightning'`の文字列定数を使用）
- **`detect(videoEl)`** … Promiseで17キーポイント配列を返す

#### `renderer.js`
- **`drawFrame(ctx, videoEl, keypoints, angles, exercise, W, H)`**
  1. `ctx.drawImage()` でカメラ映像を描画
  2. 骨格ライン17接続を描画（信頼度0.3以上のみ）
  3. 関節ドットを描画
  4. 角度ラベルを色分きで描画（黒背景で視認性確保）

#### `recorder.js`
- `canvas.captureStream(30)` でCanvas映像をストリーム取得
- iOS対応MIMEタイプを自動選択（`video/mp4;codecs=avc1` 優先）
- 停止後は `<a download>` でiPhoneに保存

#### `app.js`
- カメラ: `getUserMedia` で後カメラ優先・720p上限
- アニメーションループ: **30fpsレンダリング・10fps推論**（3フレームに1回）
- カメラ起動 → RECボタン有効化 → AIモデルをバックグラウンドロード（分離設計）
- `fitCanvas()` でCanvasを縦横比維持のままスクリーンにフィット

---

## 軽量化のための設計

| 対策 | 内容 |
|---|---|
| モデル | MoveNet Lightning（最軽量） |
| 推論間隔 | 3フレームに1回（10fps） |
| Canvas解像度 | 720p上限 |
| 描画 | 前フレームのキーポイントを使い回してレンダリングは毎フレーム継続 |
| DOM操作 | ループ中はゼロ（角度テキストはCanvas直描き） |
| 低信頼度スキップ | スコア0.3未満は描画・計算をスキップ |

---

## デプロイ情報

- **リポジトリ:** https://github.com/HTCENTRAL/wt-capture
- **ホスティング:** GitHub Pages（mainブランチ・ルートディレクトリ）
- **HTTPS:** 自動（カメラ権限に必須）

### ファイルを更新したときの反映手順

```bash
cd "C:/Users/hitos/OneDrive/Desktop/Claude練習/weight_training"
git add .
git commit -m "変更内容のメモ"
git push
```

反映まで1〜3分かかる。iPhoneのSafariはキャッシュが残るため、**設定 > Safari > 履歴とWebサイトデータを消去** をするか、アドレスバーを下に引っ張って強制リロードする。

---

## 発生した問題と修正履歴

### 1. `LoadGraphModel is not a function`
**原因:** TF.jsを分割パッケージで読み込んでいたため `tfjs-converter` が不足
**修正:** `tf-core` + `tf-backend-webgl` → `tf`（フルパッケージ）に変更

### 2. RECボタンが表示されない
**原因（複数）:**
1. カメラ起動とAIモデル読み込みを `await` で直列に繋いでいたため、モデルエラーでボタンが永遠に有効にならなかった
2. HTMLの `disabled` 属性でボタンを初期非有効化していたが、エラー時の脱出処理が不完全
3. `async/await` の一部がiPhone Safariで意図通りに動かない可能性

**修正:**
- カメラ起動 → RECボタン有効化 → AIモデル読み込み（完全分離）
- `async/await` を `Promise.then()` 形式に書き直し
- ボタンを常に表示し、テキストでステータスを示す方式に変更（「起動中」→「REC」）

### 3. Canvasが正しくスケーリングされない
**原因:** `object-fit: contain` はCanvas要素に効かない（`<img>` / `<video>` 専用）
**修正:** CSS側の `object-fit` を削除し、`fitCanvas()` 関数でJavaScriptから縦横比を計算してCSSサイズを動的に設定

### 4. iPhoneのみボタンが画面下部に隠れる（PCでは正常）
**原因:** CSS の `100vh` がiPhone Safariではブラウザのツールバー（アドレスバー・ナビゲーションバー）を含めた高さを指すため、実際の表示領域からボタンがはみ出す
**修正:** `height: 100dvh`（Dynamic Viewport Height）に変更。`dvh` はツールバーを除いた実際の表示領域の高さを指す

### 5. 縦向きで警告オーバーレイが表示される
**原因:** 横向き専用として設計し、縦向き時に「横向きにしてください」の警告を出していた
**修正:** 警告を削除し、縦横どちらでも利用可能に変更

---

## 既知の制限・今後の課題

- **MediaRecorder on iOS:** iOS 14.3以降でサポートされるが、録画ファイルは「ファイル」アプリのダウンロードフォルダに保存される（カメラロールには直接保存されない）
- **モデルの初回ロード:** 初回アクセス時はMoveNetモデル（約4MB）のダウンロードが発生するため数秒かかる。2回目以降はブラウザキャッシュで高速化される
- **ブルガリアンスクワットの前後脚判定:** 現在は左脚を前脚として固定。将来的には選択UIを追加できる
