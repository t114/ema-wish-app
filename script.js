document.addEventListener('DOMContentLoaded', () => {
    const input = document.querySelector('.wish-input');
    const directionRadios = document.getElementsByName('direction');
    const sizeSlider = document.getElementById('size-slider');
    const colorPicker = document.getElementById('color-picker');
    const downloadBtn = document.getElementById('download-btn');
    const emaImageElement = document.querySelector('.ema-image');

    // 文字の向き変更
    directionRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            input.style.writingMode = e.target.value;
        });
    });

    // 文字サイズ変更
    sizeSlider.addEventListener('input', (e) => {
        input.style.fontSize = `${e.target.value}px`;
    });

    // 文字色変更
    colorPicker.addEventListener('input', (e) => {
        input.style.color = e.target.value;
    });

    // 配置変更
    const alignmentRadios = document.getElementsByName('alignment');
    alignmentRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            input.style.textAlign = e.target.value;
        });
    });

    // フォント変更
    const fontSelector = document.getElementById('font-selector');
    fontSelector.addEventListener('change', (e) => {
        input.style.fontFamily = `"${e.target.value}", serif`;
    });

    // ダウンロード機能（Canvas自前描画）
    downloadBtn.addEventListener('click', async () => {
        // スペースや改行を維持するために trim() はしない
        const text = input.value;
        // チェック用のみ trim する
        if (!text.trim()) {
            if (!confirm('願い事が書かれていませんが、このまま保存しますか？')) {
                return;
            }
        }

        try {
            downloadBtn.disabled = true;
            downloadBtn.textContent = "画像を生成中...";

            // 1. Canvasの作成
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const naturalWidth = emaImageElement.naturalWidth;
            const naturalHeight = emaImageElement.naturalHeight;
            canvas.width = naturalWidth;
            canvas.height = naturalHeight;

            // Canvasをクリア（透明にする）
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 2. 絵馬画像の描画
            ctx.drawImage(emaImageElement, 0, 0);

            // 3. テキスト描画設定
            // 画面上の表示サイズと元画像サイズの比率を計算
            const displayWidth = emaImageElement.clientWidth;
            // 描画が完了していない場合などで0になるのを防ぐ
            const safeDisplayWidth = displayWidth || naturalWidth;
            const scaleFactor = naturalWidth / safeDisplayWidth;

            // ComputedStyleを使って正確なスタイルを取得
            const computedStyle = window.getComputedStyle(input);
            const currentFontSize = parseFloat(computedStyle.fontSize);
            const drawFontSize = currentFontSize * scaleFactor;
            const fontFamily = computedStyle.fontFamily;

            ctx.font = `${drawFontSize}px ${fontFamily}`;
            ctx.fillStyle = computedStyle.color || '#333333';
            ctx.textBaseline = 'top';

            // エリア計算
            const inputRect = input.getBoundingClientRect();
            const imgRect = emaImageElement.getBoundingClientRect();

            // 画像内での相対位置とサイズ
            const relX = (inputRect.left - imgRect.left) / imgRect.width;
            const relY = (inputRect.top - imgRect.top) / imgRect.height;
            const relW = inputRect.width / imgRect.width;
            const relH = inputRect.height / imgRect.height;

            const targetX = naturalWidth * relX;
            const targetY = naturalHeight * relY;
            const targetW = naturalWidth * relW;
            const targetH = naturalHeight * relH;

            // 描画モード判定
            const isVertical = computedStyle.writingMode === 'vertical-rl';
            const textAlign = computedStyle.textAlign; // center, left(start), right(end)

            if (isVertical) {
                // --- 縦書き描画ロジック ---
                const lines = text.split('\n');
                const lineHeight = drawFontSize * 1.8; // CSSのline-height: 1.8に合わせる

                // vertical-rl は右から左へ行が進む
                // 開始X位置: ボックスの右端からスタート (パディング等は考慮していないのでギリギリになる)
                // 少し余白を持たせるため、明示的にボックス右端を使う
                // プレビューが「右・上」寄りなら、それに合わせる

                let currentX = targetX + targetW - (lineHeight / 2); // 最初の行の中心X座標 (右端)

                // もしCSSで中央揃え(align-items/justify-content等)されていないなら、
                // テキストブロック全体を中央に寄せるかどうかはCSS次第。
                // ユーザーは「プレビュー通り」と言っている。スタイルシートでは .wish-input は top:55%, left:50%, transform... で配置されている。
                // ボックス自体は中央配置だが、テキストはそのボックスの右端(縦書き)から始まる。
                // なので currentX = targetX + targetW で正解のはず。
                // ただ、文字数が多いとはみ出るので、ボックス内に収まるように開始位置を少し調整する必要があるかも？
                // 一旦「ボックスの右端」基準で描画する。

                lines.forEach(line => {
                    // 各行の文字のY座標計算
                    // text-align: center の場合、行（列）の中で文字が縦方向に中央揃えになる
                    let startY = targetY; // デフォルトは上端

                    if (textAlign === 'center') {
                        const lineWidth = line.length * drawFontSize;
                        startY = targetY + (targetH - lineWidth) / 2;
                    }

                    let currentY = startY;

                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        const metrics = ctx.measureText(char);
                        const charWidth = metrics.width;

                        // 文字の左右中央合わせ（行の幅に対して）
                        const charX = currentX - (charWidth / 2); // ここはフォントサイズ基準ではなく文字幅基準で微調整してもよいが、monospace的配置なら固定幅のほうが綺麗かも
                        // 今回は単純に指定座標への描画
                        const drawX = currentX - (charWidth / 2); // 行の中心線に文字の中心を合わせる

                        ctx.fillText(char, drawX, currentY);
                        currentY += drawFontSize;
                    }
                    currentX -= lineHeight;
                });

            } else {
                // --- 横書き描画ロジック ---
                ctx.textBaseline = 'top';
                const lines = text.split('\n');
                const lineHeight = drawFontSize * 1.8; // CSSのline-height: 1.8に合わせる

                // 横書きは上から下へ
                // CSSでは top:60%, transform:translate(-50%, -50%) なので、
                // ボックスの中心がtop:60%の位置にある
                // テキストはボックスの上端から始まるので、ボックスの上端位置を計算
                // 微調整: プレビューとの位置合わせのため少し下にオフセット
                let currentY = targetY + (drawFontSize * 0.6);

                lines.forEach(line => {
                    let startX = targetX; // 左端

                    if (textAlign === 'center') {
                        startX = targetX + (targetW / 2);
                        ctx.textAlign = 'center';
                    } else if (textAlign === 'right') {
                        startX = targetX + targetW;
                        ctx.textAlign = 'right';
                    } else {
                        ctx.textAlign = 'left';
                    }

                    ctx.fillText(line, startX, currentY);
                    currentY += lineHeight;
                });
            }

            // 5. 画像生成とダウンロード
            const dataUrl = canvas.toDataURL('image/png');
            const filename = `ema_wish_${new Date().getTime()}.png`;

            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // フォールバック
            setTimeout(() => {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    const msg = document.createElement('div');
                    msg.innerHTML = `
                        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; text-align:center; padding:20px;">
                            <p>画像が保存されましたか？<br>もし保存されていない場合は、<br>以下の画像を長押しして保存してください。</p>
                            <img src="${dataUrl}" style="max-width:80%; max-height:60%; border:2px solid white; margin:10px 0;">
                            <button onclick="this.parentElement.remove()" style="padding:10px 20px; background:#fff; color:#333; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">閉じる</button>
                        </div>
                     `;
                    document.body.appendChild(msg);
                }
            }, 1000);

        } catch (err) {
            console.error('保存に失敗しました:', err);
            alert('画像の保存中にエラーが発生しました:\n' + err.message);
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = "絵馬を保存する";
        }
    });

    // ========== 画像透過チェッカー ==========
    const urlInput = document.getElementById('image-url-input');
    const checkUrlBtn = document.getElementById('check-url-btn');
    const fileInput = document.getElementById('file-input');
    const checkerResult = document.getElementById('checker-result');
    const resultContent = document.getElementById('result-content');
    const checkerCanvas = document.getElementById('checker-canvas');

    // URL入力からチェック
    checkUrlBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            alert('画像URLを入力してください');
            return;
        }
        checkImageTransparency(url, 'url');
    });

    // ファイルアップロードからチェック
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            checkImageTransparency(event.target.result, 'file');
        };
        reader.readAsDataURL(file);
    });

    // 透過判定メイン関数
    function checkImageTransparency(src, sourceType) {
        checkerResult.style.display = 'none';
        resultContent.innerHTML = '<p>読み込み中...</p>';
        checkerResult.style.display = 'block';

        const img = new Image();

        // CORS対応（URL入力の場合）
        if (sourceType === 'url') {
            img.crossOrigin = 'anonymous';
        }

        img.onload = () => {
            try {
                const canvas = checkerCanvas;
                const ctx = canvas.getContext('2d');

                canvas.width = img.width;
                canvas.height = img.height;

                ctx.drawImage(img, 0, 0);

                // ピクセルデータ取得
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;

                // アルファチャンネルをスキャン
                let hasTransparency = false;
                let transparentPixels = 0;
                const totalPixels = canvas.width * canvas.height;

                for (let i = 3; i < pixels.length; i += 4) {
                    if (pixels[i] < 255) {
                        hasTransparency = true;
                        transparentPixels++;
                    }
                }

                const transparencyPercentage = ((transparentPixels / totalPixels) * 100).toFixed(2);

                // 結果表示
                let resultHTML = '';
                if (hasTransparency) {
                    resultHTML = `
                        <p class="result-success">✓ この画像は透過PNG（アルファチャンネルあり）です</p>
                        <p>透過ピクセル: ${transparentPixels.toLocaleString()} / ${totalPixels.toLocaleString()} (${transparencyPercentage}%)</p>
                        <p>画像サイズ: ${img.width} × ${img.height}px</p>
                    `;
                } else {
                    resultHTML = `
                        <p class="result-fail">✗ この画像は透過なし（アルファチャンネルなし）です</p>
                        <p>すべてのピクセルが不透明です</p>
                        <p>画像サイズ: ${img.width} × ${img.height}px</p>
                    `;
                }

                // プレビュー画像を追加
                resultHTML += `<img src="${src}" class="result-preview" alt="プレビュー">`;

                resultContent.innerHTML = resultHTML;

            } catch (err) {
                console.error('画像解析エラー:', err);
                resultContent.innerHTML = `
                    <p class="result-fail">エラー: 画像の解析に失敗しました</p>
                    <p>${err.message}</p>
                `;
            }
        };

        img.onerror = () => {
            let errorMsg = '';
            if (sourceType === 'url') {
                errorMsg = `
                    <p class="result-fail">エラー: 画像の読み込みに失敗しました</p>
                    <p>考えられる原因:</p>
                    <ul>
                        <li>URLが正しくない</li>
                        <li>CORS制限により読み込めない（この場合は「方法2: ファイルをアップロード」をお試しください）</li>
                        <li>画像が存在しない</li>
                    </ul>
                `;
            } else {
                errorMsg = '<p class="result-fail">エラー: ファイルの読み込みに失敗しました</p>';
            }
            resultContent.innerHTML = errorMsg;
        };

        img.src = src;
    }
});
