document.addEventListener('DOMContentLoaded', () => {
    // ステップ2でコピーしたGASのウェブアプリURLをここに貼り付ける
    const API_URL = 'https://script.google.com/macros/s/AKfycbzPNnFpRYcwc5jK0wVSMrljU60m6uXoSG3v0GNP3yitj5G9A8HAPV0CO-iCc_1hGRmBBA/exec';

    // DOM要素
    const caseListDiv = document.getElementById('case-list');
    const addCaseButton = document.getElementById('add-case-button');
    const newCaseNameInput = document.getElementById('new-case-name');
    const refreshBtn = document.getElementById('refresh-btn');
    
    let cases = []; // 案件データを保持する配列

    // APIを叩いて全案件データを取得・表示する
    async function fetchAndRenderCases() {
        try {
            const response = await fetch(`${API_URL}?action=getAllCases`);
            const result = await response.json();
            
            if (!result.success) throw new Error(result.message);
            
            cases = result.data;
            renderCases();

        } catch (error) {
            console.error('Error fetching cases:', error);
            caseListDiv.innerHTML = `<p style="color: red;">案件の読み込みに失敗しました: ${error.message}</p>`;
        }
    }

    // 案件データを元にHTMLを描画する
    function renderCases() {
        caseListDiv.innerHTML = '';
        if (cases.length === 0) {
            caseListDiv.innerHTML = '<p>登録されている案件はありません。</p>';
            return;
        }

        cases.forEach(c => {
            const item = document.createElement('div');
            item.className = `case-item status-${c.status.replace(/\s/g, '-')}`;
            item.dataset.caseId = c.id;

            if (c.status === 'ダブルチェック完了') {
                item.classList.add('completed');
            }

            const statusInfo = getStatusInfo(c);
            
            item.innerHTML = `
                <div class="case-header">
                    <span class="case-name">${c.caseName}</span>
                    <span class="case-status status-${c.status}">${c.status}</span>
                </div>
                <div class="case-body">${statusInfo.message}</div>
                <div class="case-actions">
                    ${statusInfo.actionHtml}
                </div>
            `;
            caseListDiv.appendChild(item);
        });
    }

    // ステータスに応じた表示情報とアクションボタンHTMLを返す
    function getStatusInfo(c) {
        let message = '';
        let actionHtml = '';

        switch (c.status) {
            case '作業待ち':
                message = '作業開始をお待ちしています。';
                actionHtml = `<input type="text" class="input worker-input" placeholder="作業者名"><button class="btn btn-primary action-btn">作業開始</button>`;
                break;
            case '作業中':
                message = `作業者: ${c.worker}さん`;
                actionHtml = `<input type="text" class="input worker-input" placeholder="あなたの名前" value="${c.worker}" readonly><button class="btn btn-primary action-btn">作業完了</button>`;
                break;
            case '作業完了':
                message = `作業完了者: ${c.worker}さん`;
                actionHtml = `<input type="text" class="input worker-input" placeholder="チェック者名"><button class="btn btn-primary action-btn">ﾀﾞﾌﾞﾙﾁｪｯｸ開始</button>`;
                break;
            case 'ダブルチェック中':
                message = `作業者: ${c.worker}さん / チェック者: ${c.doubleChecker}さん`;
                actionHtml = `<input type="text" class="input worker-input" placeholder="あなたの名前" value="${c.doubleChecker}" readonly><button class="btn btn-primary action-btn">ﾀﾞﾌﾞﾙﾁｪｯｸ完了</button>`;
                break;
            case 'ダブルチェック完了':
                message = `作業者: ${c.worker}さん / 最終確認者: ${c.doubleChecker}さん`;
                actionHtml = ''; // No action
                break;
        }
        return { message, actionHtml };
    }

    // 案件の作成または更新をAPIにPOSTする
    async function postToApi(payload) {
        try {
             const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors', // GASへのPOSTではCORSエラー回避のために必要
                cache: 'no-cache',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                redirect: 'follow'
            });
            // no-corsモードではレスポンス内容を確認できないため、成功したと仮定してリストを再読み込み
            setTimeout(fetchAndRenderCases, 1000); // GAS側での処理時間を考慮して少し待つ

        } catch (error) {
            console.error('Error posting to API:', error);
            alert('APIへの送信に失敗しました。');
        }
    }

    // イベントリスナーの設定
    // 新規案件作成
    addCaseButton.addEventListener('click', () => {
        const caseName = newCaseNameInput.value.trim();
        if (caseName) {
            addCaseButton.disabled = true;
            addCaseButton.textContent = '作成中...';
            postToApi({ action: 'createCase', name: caseName }).finally(() => {
                newCaseNameInput.value = '';
                addCaseButton.disabled = false;
                addCaseButton.textContent = '案件作成';
            });
        }
    });
    
    // 各案件のアクションボタン
    caseListDiv.addEventListener('click', e => {
        if (e.target.classList.contains('action-btn')) {
            const button = e.target;
            const item = button.closest('.case-item');
            const id = item.dataset.caseId;
            const currentCase = cases.find(c => c.id == id);
            const userInput = item.querySelector('.worker-input');
            const user = userInput ? userInput.value.trim() : '';

            let payload;
            switch(currentCase.status) {
                case '作業待ち':
                    if (!user) { alert('作業者名を入力してください。'); return; }
                    payload = { action: 'updateCase', id, status: '作業中', field: 'worker', user };
                    break;
                case '作業中':
                    payload = { action: 'updateCase', id, status: '作業完了' };
                    break;
                case '作業完了':
                    if (!user) { alert('チェック者名を入力してください。'); return; }
                    if (user === currentCase.worker) { alert('作業者とチェック者は別の人にしてください。'); return; }
                    payload = { action: 'updateCase', id, status: 'ダブルチェック中', field: 'doubleChecker', user };
                    break;
                case 'ダブルチェック中':
                     payload = { action: 'updateCase', id, status: 'ダブルチェック完了' };
                     break;
            }

            if (payload) {
                button.disabled = true;
                button.textContent = '更新中...';
                postToApi(payload);
            }
        }
    });

    // 更新ボタン
    refreshBtn.addEventListener('click', fetchAndRenderCases);

    // 初期読み込みと定期更新
    fetchAndRenderCases();
    setInterval(fetchAndRenderCases, 30000); // 30秒ごとに自動更新
});