        const params    = new URLSearchParams(window.location.search);
        const waitSecs  = parseInt(params.get('retry') || '60');
        const returnUrl = params.get('from') || history.back();

        let remaining = waitSecs;
        const timerEl = document.getElementById('timer');
        const btnEl   = document.getElementById('btnBack');

        function tick() {
            timerEl.textContent = remaining;
            if (remaining <= 0) {
                timerEl.textContent = '0';
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="ti ti-arrow-left"></i> Go Back';
                return;
            }
            remaining--;
            setTimeout(tick, 1000);
        }

        tick();

        function goBack() {
            if (params.get('from')) {
                window.location.href = params.get('from');
            } else {
                history.back();
            }
        }
