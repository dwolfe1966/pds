var ApiWrapper = (function (axios) {
    'use strict';

    class ApiResponseHelper {
        params;
        constructor(params) {
            this.params = params;
        }
        getError() {
            return this.params.error;
        }
        getData() {
            return this.params.response?.data;
        }
        isSuccess() {
            return !this.getError();
        }
        isDataSuccess() {
            return this.getData()?.success === true;
        }
    }
    class ApiResponseHelperGeneral extends ApiResponseHelper {
    }
    class ApiResponseHelperSearchTeaser extends ApiResponseHelper {
        params;
        option;
        constructor(params, option) {
            super(params);
            this.params = params;
            this.option = option;
        }
        currentPage = 1;
        async getMore() {
            const previousPage = this.currentPage;
            try {
                if (!this.hasMore()) {
                    return null;
                }
                const response = (await this.option?.getMore?.(this.makeGetMoreParams())) ?? [];
                const transient = this.getTransientFromResponse(response);
                this.pushIdentities(transient);
                return transient?.identities?.length ? transient.identities : null;
            }
            catch (e) {
                console.error(e);
                this.currentPage = previousPage;
                return null;
            }
        }
        getTeaserInput() {
            return this.getCommerceContent()?.data?.teaserInput;
        }
        getCommerceContent() {
            return this.getData()?.commerceContent;
        }
        getIdentities() {
            const idiRaw = this.getIdiRaw();
            return idiRaw?.transient?.identities ?? [];
        }
        getTotalCount() {
            const idiRaw = this.getIdiRaw();
            return typeof idiRaw?.transient?.total === 'number' ? idiRaw.transient.total : 0;
        }
        getIdiRaw() {
            const raws = this.getCommerceContent()?.raws ?? [];
            return raws.find((e) => e?.meta?.provider === 'IDI');
        }
        getFailedCode() {
            const idiRaw = this.getIdiRaw();
            return idiRaw?.subType ? idiRaw?.subType : null;
        }
        hasMore() {
            return this.getIdentities().length < this.getTotalCount();
        }
        pushIdentities(transient) {
            if (!transient?.identities?.length) {
                return;
            }
            const idiRaw = this.getIdiRaw();
            idiRaw.transient.identities.push(...transient.identities);
            idiRaw.transient.total = transient.total;
        }
        getTransientFromResponse(response) {
            const raws = response?.data?.commerceContent?.raws ?? [];
            const idiRaw = raws.find((e) => e?.meta?.provider === 'IDI');
            return idiRaw?.transient;
        }
        makeGetMoreParams() {
            this.currentPage += 1;
            return {
                commerceContentId: this.getCommerceContent()?._id,
                page: this.currentPage,
            };
        }
    }
    class ApiResponseHelperDataSuccess extends ApiResponseHelper {
        isSuccess() {
            return this.getData()?.success === true;
        }
    }

    function generateRandom(length = 32) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const randomValues = new Uint32Array(length);
        crypto.getRandomValues(randomValues);
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset[randomValues[i] % charset.length];
        }
        return result;
    }
    const stringHelper = {
        generateRandom,
    };

    const modalSettings = {
        overlayStyle: {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '9999',
        },
        modalStyle: {
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            minWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
        },
    };
    function turnstileModal(params) {
        if (!params.siteKey) {
            return Promise.reject('No siteKey');
        }
        return new Promise((resolve, reject) => {
            const SITE_KEY = params.siteKey;
            const SCRIPT_ID = 'api-wrapper-turnstile-script';
            const CONTAINER_ID = 'api-wrapper-turnstile-overlay';
            if (document.getElementById(CONTAINER_ID)) {
                console.warn('Turnstile is already running.');
                return;
            }
            const overlay = document.createElement('div');
            overlay.id = CONTAINER_ID;
            Object.assign(overlay.style, modalSettings.overlayStyle);
            const widgetBox = document.createElement('div');
            widgetBox.id = 'api-wrapper-turnstile-widget';
            overlay.appendChild(widgetBox);
            document.body.appendChild(overlay);
            const cleanup = () => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                delete window.onTurnstileSuccess;
                delete window.onTurnstileError;
                const scriptTag = document.getElementById(SCRIPT_ID);
                if (scriptTag) {
                    scriptTag.remove();
                }
                if (window.turnstile) {
                    try {
                        window.turnstile.remove(widgetBox);
                    }
                    catch (_e) {
                        // consume error
                    }
                }
            };
            window.onTurnstileSuccess = (token) => {
                cleanup();
                resolve(token);
            };
            window.onTurnstileError = () => {
                cleanup();
                reject(new Error('Turnstile verification failed or expired.'));
            };
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.id = SCRIPT_ID;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (window.turnstile) {
                    window.turnstile.render('#api-wrapper-turnstile-widget', {
                        sitekey: SITE_KEY,
                        callback: window.onTurnstileSuccess,
                        'error-callback': window.onTurnstileError,
                        'expired-callback': window.onTurnstileError,
                    });
                }
            };
            script.onerror = () => {
                cleanup();
                reject(new Error('Failed to load Turnstile script.'));
            };
            document.head.appendChild(script);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    reject(new Error('User canceled the captcha.'));
                }
            });
        });
    }
    function promptModal(params) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, modalSettings.overlayStyle);
            const modal = document.createElement('div');
            Object.assign(modal.style, modalSettings.modalStyle);
            const label = document.createElement('p');
            label.textContent = params.message;
            label.style.margin = '0 0 10px 0';
            label.style.fontWeight = 'bold';
            const input = document.createElement('input');
            input.type = params?.passwordFlag ? 'password' : 'text';
            if (params.placeholder) {
                input.placeholder = params.placeholder;
            }
            Object.assign(input.style, {
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
            });
            const buttonGroup = document.createElement('div');
            buttonGroup.style.display = 'flex';
            buttonGroup.style.justifyContent = 'flex-end';
            buttonGroup.style.gap = '8px';
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Confirm';
            styleButton(confirmButton, '#007bff', 'white');
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            confirmButton.onclick = () => {
                const value = input.value;
                cleanup();
                resolve(value);
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    confirmButton.click();
                }
            };
            buttonGroup.appendChild(confirmButton);
            if (params.htmlData) {
                const htmlDataWrapper = document.createElement('div');
                htmlDataWrapper.innerHTML = params.htmlData;
                modal.appendChild(htmlDataWrapper);
            }
            modal.appendChild(label);
            modal.appendChild(input);
            modal.appendChild(buttonGroup);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            input.focus();
        });
    }
    function messageModal(params) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, modalSettings.overlayStyle);
            const modal = document.createElement('div');
            Object.assign(modal.style, modalSettings.modalStyle);
            const message = document.createElement('p');
            message.textContent = params.message;
            message.style.margin = '0 0 10px 0';
            const buttonGroup = document.createElement('div');
            buttonGroup.style.display = 'flex';
            buttonGroup.style.justifyContent = 'flex-end';
            buttonGroup.style.gap = '8px';
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            styleButton(closeButton, '#007bff', 'white');
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            closeButton.onclick = () => {
                cleanup();
                resolve();
            };
            buttonGroup.appendChild(closeButton);
            modal.appendChild(message);
            modal.appendChild(buttonGroup);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }
    function confirmationModal(params) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            Object.assign(overlay.style, modalSettings.overlayStyle);
            const modal = document.createElement('div');
            Object.assign(modal.style, modalSettings.modalStyle);
            const message = document.createElement('p');
            message.textContent = params.message;
            message.style.margin = '0 0 10px 0';
            const cleanup = () => {
                document.body.removeChild(overlay);
            };
            const buttonGroup = document.createElement('div');
            buttonGroup.style.display = 'flex';
            buttonGroup.style.justifyContent = 'flex-end';
            buttonGroup.style.gap = '8px';
            const confirmButton = document.createElement('button');
            confirmButton.textContent = 'Confirm';
            styleButton(confirmButton, '#007bff', 'white');
            confirmButton.onclick = () => {
                cleanup();
                resolve(true);
            };
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            styleButton(cancelButton, '#666666ff', 'white');
            cancelButton.onclick = () => {
                cleanup();
                resolve(false);
            };
            buttonGroup.appendChild(confirmButton);
            buttonGroup.appendChild(cancelButton);
            modal.appendChild(message);
            modal.appendChild(buttonGroup);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        });
    }
    function dynamicModal(params) {
        return new Function(params?.dynamicData ?? '')();
    }
    function getLoadingModal(params) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, modalSettings.overlayStyle);
        const modal = document.createElement('div');
        Object.assign(modal.style, modalSettings.modalStyle);
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        const message = document.createElement('p');
        message.textContent = params.message;
        message.style.margin = '0 0 15px 0';
        if (!document.getElementById('api-modal-wrapper-spinner-style')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'api-modal-wrapper-spinner-style';
            styleSheet.textContent = `
      @keyframes api-modal-wrapper-spinner-style-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
            document.head.appendChild(styleSheet);
        }
        const spinner = document.createElement('div');
        Object.assign(spinner.style, {
            width: '30px',
            height: '30px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #007bff',
            borderRadius: '50%',
            animation: 'api-modal-wrapper-spinner-style-spin 0.8s linear infinite',
        });
        return {
            open: () => {
                modal.appendChild(message);
                modal.appendChild(spinner);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
            },
            close: () => {
                document.body.removeChild(overlay);
            },
        };
    }
    function styleButton(btn, bg, color) {
        Object.assign(btn.style, {
            padding: '8px 16px',
            backgroundColor: bg,
            color: color,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
        });
    }
    const ApiWrapperModal = {
        turnstileModal,
        promptModal,
        messageModal,
        confirmationModal,
        dynamicModal,
        getLoadingModal,
    };

    const PLACEHOLDER_RE = /\$\{([\s\S]+?)\}/g;
    const CONTROL_KEYWORDS = new Set(['break', 'case', 'catch', 'else', 'for', 'if', 'switch', 'try', '{', '}']);
    const MAX_ITERATIONS = 32;
    const tokenize = (source) => {
        const tokens = [];
        const scanner = new RegExp(PLACEHOLDER_RE.source, 'g');
        let lastIndex = 0;
        let exprCount = 0;
        let hit;
        while ((hit = scanner.exec(source)) !== null) {
            if (hit.index > lastIndex) {
                tokens.push({ type: 'text', value: source.slice(lastIndex, hit.index) });
            }
            const code = hit[1].trim();
            if (!code) {
                lastIndex = scanner.lastIndex;
                continue;
            }
            const leadingKeyword = code.match(/^([A-Za-z]+\b|[{}])/)?.[1];
            if (leadingKeyword && CONTROL_KEYWORDS.has(leadingKeyword)) {
                tokens.push({ type: 'stmt', code });
            }
            else {
                tokens.push({ type: 'expr', code });
                exprCount += 1;
            }
            lastIndex = scanner.lastIndex;
        }
        if (lastIndex < source.length) {
            tokens.push({ type: 'text', value: source.slice(lastIndex) });
        }
        return { tokens, exprCount };
    };
    const emitCode = (tokens) => {
        const lines = tokens.map((token) => {
            if (token.type === 'text') {
                return `out.push(${JSON.stringify(token.value)});`;
            }
            if (token.type === 'stmt') {
                return `${token.code};`;
            }
            const keyLiteral = JSON.stringify(token.code);
            return `try { out.push(${keyLiteral} in options ? options[${keyLiteral}] : options.${token.code}); } catch (_e) {}`;
        });
        return `var out = [];\n${lines.join('\n')}\nreturn out.join('');`;
    };
    const TemplateEngine = (source, options) => {
        let current = source;
        for (let pass = 0; pass < MAX_ITERATIONS; pass += 1) {
            const { tokens, exprCount } = tokenize(current);
            const body = emitCode(tokens);
            let next;
            try {
                next = new Function('options', body)(options);
            }
            catch (e) {
                console.error('TemplateEngine render failure:', e, '\ngenerated code:\n', body);
                throw e;
            }
            if (exprCount === 0)
                return next;
            current = next;
        }
        throw new Error(`TemplateEngine exceeded ${MAX_ITERATIONS} render passes`);
    };

    /**
     * shared 에서 복제하여 가져옴.
     */
    class ShapeCompiled {
        brandDomain;
        brandId;
        brandName;
        shConId;
        containerName;
        containerDesc;
        containerStatus;
        shColId;
        collectionName;
        collectionDesc;
        collectionStatus;
        values = { code: {} };
        types = {};
        revisions = {};
        ids = {};
        keys = { comp: {} };
        serverOnlyKeys = { comp: [] };
        ip;
        device;
        requestZip;
        requestCountry;
        requestState;
        requestCity;
        timestamp;
        cached = false;
        static fromData(data) {
            const shapeCompiled = new ShapeCompiled();
            if (data) {
                Object.assign(shapeCompiled, data);
            }
            return shapeCompiled;
        }
        setCode(key, value) {
            let values = this.values.code;
            const keyArray = key.split('.');
            keyArray.forEach((key, index) => {
                if (!values[key]) {
                    values[key] = {};
                }
                if (index + 1 === keyArray.length) {
                    values[key] = value;
                }
                else {
                    values = values[key];
                }
            });
        }
        get(key) {
            if (key) {
                if (this.isShComp(key)) {
                    return this.getShComp(key);
                }
                else {
                    return this.traverseValues(key);
                }
            }
        }
        getShComp(key, throwFlag = false) {
            let rendered = null;
            if (this.values[key]) {
                rendered = this.render(this.values[key]);
            }
            if (this.types[key] === 'json') {
                try {
                    rendered = JSON.parse(rendered);
                }
                catch (e) {
                    console.error('ShapeCompiled Error', this.shConId, this.shColId, this.ids[key], key, rendered, e);
                    if (throwFlag) {
                        e.message =
                            `ShapeCompiled error. shConId:${this.shConId} shColId:${this.shColId} ${key} ID:${this.ids[key]}. ` +
                                e?.['message'] +
                                ':' +
                                rendered;
                        throw e;
                    }
                    rendered = null;
                }
            }
            else {
                if (rendered === null || rendered === undefined) {
                    rendered = '';
                }
            }
            return rendered;
        }
        isShComp(key) {
            return key && typeof key === 'string' && key.startsWith('comp.');
        }
        traverseKeys(key) {
            try {
                let keys = this.keys;
                for (const k of key.split('.')) {
                    if (keys) {
                        keys = keys[k];
                    }
                    else {
                        keys = null;
                        break;
                    }
                }
                return keys;
            }
            catch (e) {
                console.log('ShapeCompiled.traverseKeys Error', e);
                return null;
            }
        }
        checkBrandId(brandId) {
            if (!brandId) {
                return false;
            }
            const checkBrandIdComp = this.getShComp('comp.brand.check.brandId');
            if (!checkBrandIdComp) {
                return false;
            }
            const regexp = new RegExp(checkBrandIdComp);
            return regexp.test(brandId);
        }
        traverseValues(key) {
            try {
                let values = this.values;
                for (const k of key.split('.')) {
                    if (values) {
                        values = values[k];
                    }
                    else {
                        values = null;
                        break;
                    }
                }
                if (values && values['$value']) {
                    return values['$value'];
                }
                else {
                    return values;
                }
            }
            catch (e) {
                console.error(e, key);
                return '';
            }
        }
        render(content) {
            return TemplateEngine(content, this.values);
        }
    }

    function getValidQueryString(queryString, option) {
        if (typeof queryString !== 'string' || queryString.trim().length === 0) {
            return null;
        }
        try {
            const cleanStr = queryString.startsWith('?') ? queryString.slice(1) : queryString;
            decodeURIComponent(cleanStr);
            const params = new URLSearchParams(queryString);
            if (Array.isArray(option?.excludeKeys)) {
                option.excludeKeys.forEach((key) => params.delete(key));
            }
            const result = params.toString();
            return result.length > 0 ? `?${result}` : null;
        }
        catch (e) {
            console.error(e);
            return null;
        }
    }
    function makeBillingSeriesId(params) {
        return `${params.type}|${params.clientId}|${params.apiId}|${new Date().getTime()}|${stringHelper.generateRandom(8)}`;
    }
    function equalsShapeCompiledParams(a, b) {
        return a?.shn === b?.shn && a?.shl === b?.shl && a?.cascade === b?.cascade;
    }
    class ApiWrapperApi {
        constructor(params) {
            this.request = params.request;
        }
        request;
        shapeCompiledPromise = null;
        shapeCompiledParams;
        previousShapeCompiledParams;
        login = async (params) => {
            try {
                const response = await this.request({
                    url: '/auth/login',
                    method: 'post',
                    data: params,
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        logout = async () => {
            try {
                const response = await this.request({
                    url: '/auth/logout',
                    method: 'post',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        updateUser = async (params) => {
            try {
                const data = {};
                Object.keys(params).forEach((key) => {
                    const value = params[key];
                    if (value) {
                        data[key] = value;
                    }
                });
                const response = await this.request({
                    url: '/user/update',
                    method: 'post',
                    data,
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        changePassword = async (password) => {
            try {
                const response = await this.request({
                    url: '/user/changePassword',
                    method: 'post',
                    data: { password },
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        resetPassword = async (email) => {
            try {
                const response = await this.request({
                    url: '/user/resetPassword',
                    method: 'post',
                    data: { email },
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        getUserOrders = async () => {
            try {
                const response = await this.request({
                    url: '/commerceBilling/getUserOrders',
                    method: 'post',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        getActivatedProductTypes = async () => {
            try {
                const response = await this.request({
                    url: '/commerceBilling/getActivatedProductTypes',
                    method: 'post',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        cancelOrUncancelUserOrder = async (flag, orderId) => {
            try {
                const response = await this.request({
                    url: '/commerceBilling/cancelOrUncancelOrder',
                    method: 'post',
                    data: { flag, orderId },
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        findOfferByShmName = async (params) => {
            try {
                const response = await this.request({
                    url: '/commerce/offer/findByShmName',
                    method: 'post',
                    data: {
                        shmName: params.shmName,
                        key: params.key ? params.key : undefined,
                    },
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        searchTeaser = async (params) => {
            try {
                const response = await this.request({
                    url: '/idLookup/teaser/search',
                    method: 'post',
                    data: params,
                });
                const getMore = async (getMoreParams) => {
                    return await this.request({
                        url: '/idLookup/teaser/search',
                        method: 'post',
                        data: getMoreParams,
                    });
                };
                return new ApiResponseHelperSearchTeaser({ response }, { getMore });
            }
            catch (error) {
                return new ApiResponseHelperSearchTeaser({ response: null, error });
            }
        };
        createReport = async (params) => {
            try {
                const response = await this.request({
                    url: '/idLookup/report/create',
                    method: 'post',
                    data: params,
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        downloadPdfReport = async (params) => {
            const loadingModal = ApiWrapperModal.getLoadingModal({ message: 'Generating PDF. Please wait.' });
            try {
                const confirmation = await ApiWrapperModal.confirmationModal({ message: 'Would you like to download the PDF?' });
                if (!confirmation) {
                    return;
                }
                loadingModal.open();
                const response = await this.request({
                    url: `/idLookup/report/pdf/${params.commerceContentId}`,
                    method: 'get',
                    responseType: 'blob',
                });
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                const fileName = response.headers['x-pdf-file-name'] ?? 'report';
                link.href = blobUrl;
                link.download = `${fileName}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
                loadingModal.close();
                await ApiWrapperModal.messageModal({ message: 'Download is complete.' });
            }
            catch (error) {
                console.error(error);
                loadingModal.close();
                await ApiWrapperModal.messageModal({ message: 'Download failed. Please try again later.' });
            }
        };
        getReport = async (params) => {
            try {
                const response = await this.request({
                    url: `/idLookup/report/detail/${params.commerceContentId}`,
                    method: 'get',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        getReports = async (params) => {
            try {
                const response = await this.request({
                    url: '/idLookup/report/list',
                    method: 'get',
                    params,
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        countUserTeaserSearches = async () => {
            try {
                const response = await this.request({
                    url: '/idLookup/statistic/userTeaserSearches',
                    method: 'get',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        countUserReportCreations = async () => {
            try {
                const response = await this.request({
                    url: '/idLookup/statistic/userReportCreations',
                    method: 'get',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        countUserPdfDownloads = async () => {
            try {
                const response = await this.request({
                    url: '/idLookup/statistic/userPdfDownloads',
                    method: 'get',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        countUserNameSearches = async () => {
            try {
                const response = await this.request({
                    url: '/idLookup/statistic/userNameSearches',
                    method: 'get',
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        searchOptOut = async (params) => {
            try {
                const response = await this.request({
                    url: '/optOut/search',
                    method: 'post',
                    data: params,
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        requestOptOut = async (params) => {
            try {
                const response = await this.request({
                    url: '/optOut/request',
                    method: 'post',
                    data: params,
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        confirmationOptOut = async (params) => {
            try {
                const response = await this.request({
                    url: '/optOut/confirmation',
                    method: 'get',
                    params,
                });
                return new ApiResponseHelperDataSuccess({ response });
            }
            catch (error) {
                return new ApiResponseHelperDataSuccess({ response: null, error });
            }
        };
        sale = async (params) => {
            try {
                const queryString = getValidQueryString(params.queryString, { excludeKeys: ['clientId', 'apiId'] });
                const response = await this.request({
                    url: `/commerceBilling/sale${queryString ? queryString : ''}`,
                    method: 'post',
                    data: params,
                    __requestCallback: (config) => {
                        const { clientId, apiId } = config.params;
                        const billingSeriesId = makeBillingSeriesId({ clientId, apiId, type: 'sale' });
                        config.data = {
                            ...config.data,
                            billingSeriesId,
                        };
                    },
                });
                return new ApiResponseHelperDataSuccess({ response });
            }
            catch (error) {
                return new ApiResponseHelperDataSuccess({ response: null, error });
            }
        };
        tokenSale = async (params) => {
            try {
                const queryString = getValidQueryString(params.queryString, { excludeKeys: ['clientId', 'apiId'] });
                const response = await this.request({
                    url: `/commerceBilling/tokenSale${queryString ? queryString : ''}`,
                    method: 'post',
                    data: params,
                    __requestCallback: (config) => {
                        const { clientId, apiId } = config.params;
                        const billingSeriesId = makeBillingSeriesId({ clientId, apiId, type: 'sale' });
                        config.data = {
                            ...config.data,
                            billingSeriesId,
                        };
                    },
                });
                return new ApiResponseHelperDataSuccess({ response });
            }
            catch (error) {
                return new ApiResponseHelperDataSuccess({ response: null, error });
            }
        };
        billingSignup = async (params) => {
            try {
                const queryString = getValidQueryString(params.queryString, { excludeKeys: ['clientId', 'apiId'] });
                const response = await this.request({
                    url: `/commerceBilling/signup${queryString ? queryString : ''}`,
                    method: 'post',
                    data: params,
                    __requestCallback: (config) => {
                        const { clientId, apiId } = config.params;
                        const billingSeriesId = makeBillingSeriesId({ clientId, apiId, type: 'signup' });
                        config.data = {
                            ...config.data,
                            billingSeriesId,
                        };
                    },
                });
                return new ApiResponseHelperDataSuccess({ response });
            }
            catch (error) {
                return new ApiResponseHelperDataSuccess({ response: null, error });
            }
        };
        setShapeParams = (params) => {
            this.shapeCompiledParams = params;
        };
        getShapeCompiled = async () => {
            if (this.shapeCompiledPromise &&
                equalsShapeCompiledParams(this.previousShapeCompiledParams, this.shapeCompiledParams)) {
                return this.shapeCompiledPromise;
            }
            this.previousShapeCompiledParams = this.shapeCompiledParams;
            this.shapeCompiledPromise = (async () => {
                try {
                    const response = await this.request({
                        url: '/shape/compiled',
                        method: 'get',
                        params: this.shapeCompiledParams
                            ? {
                                shn: this.shapeCompiledParams?.shn ? this.shapeCompiledParams?.shn : undefined,
                                shl: this.shapeCompiledParams?.shl ? this.shapeCompiledParams?.shl : undefined,
                                cascade: this.shapeCompiledParams?.cascade === true ? 'true' : undefined,
                            }
                            : undefined,
                    });
                    return ShapeCompiled.fromData(response?.data);
                }
                catch (error) {
                    console.error(error);
                    this.shapeCompiledPromise = null;
                    this.previousShapeCompiledParams = undefined;
                    throw error;
                }
            })();
            return this.shapeCompiledPromise;
        };
        createContactMessage = async (params) => {
            try {
                const payload = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, value || undefined]));
                const response = await this.request({
                    url: '/contactMessage/create',
                    method: 'post',
                    data: {
                        input: payload,
                    },
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        replyContactMessage = async (params) => {
            try {
                const formData = new FormData();
                formData.append('contactMessageId', params.contactMessageId);
                formData.append('hash', params.hash);
                formData.append('message', params.message);
                formData.append('contentType', params.contentType);
                if (params.attachments && params.attachments.length > 0) {
                    Array.from(params.attachments).forEach((file) => {
                        formData.append('attachments', file);
                    });
                }
                const response = await this.request({
                    url: `/contactMessage/userReply?hash=${params.hash}&contactMessageId=${params.contactMessageId}`,
                    method: 'post',
                    data: formData,
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        getContactMessageHistories = async (params) => {
            try {
                const response = await this.request({
                    url: '/contactMessage/histories',
                    method: 'get',
                    params: {
                        contactMessageId: params.contactMessageId,
                        hash: params.hash,
                        lastId: params.lastId ? params.lastId : undefined,
                    },
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        createManagedContact = async (params) => {
            try {
                const response = await this.request({
                    url: '/managedContact/create',
                    method: 'post',
                    data: {
                        type: params.contactType,
                        contactAddress: params.contactAddress,
                        campaignKey: params.campaignKey ? params.campaignKey : undefined,
                    },
                });
                return new ApiResponseHelperGeneral({ response });
            }
            catch (error) {
                return new ApiResponseHelperGeneral({ response: null, error });
            }
        };
        unsubscribeManagedContactMail = async (params) => {
            try {
                const response = await this.request({
                    url: '/managedContact/unsubscribe/mail',
                    method: 'get',
                    params,
                });
                return new ApiResponseHelperDataSuccess({ response });
            }
            catch (error) {
                return new ApiResponseHelperDataSuccess({ response: null, error });
            }
        };
        createTracking = async (data) => {
            try {
                const response = await this.request({
                    url: '/tracking/create',
                    method: 'post',
                    data,
                });
                return new ApiResponseHelperDataSuccess({ response });
            }
            catch (error) {
                return new ApiResponseHelperDataSuccess({ response: null, error });
            }
        };
        auth = {
            login: this.login,
            logout: this.logout,
        };
        user = {
            update: this.updateUser,
            changePassword: this.changePassword,
            resetPassword: this.resetPassword,
        };
        idLookup = {
            searchTeaser: this.searchTeaser,
            downloadPdfReport: this.downloadPdfReport,
            createReport: this.createReport,
            getReport: this.getReport,
            getReports: this.getReports,
            countUserTeaserSearches: this.countUserTeaserSearches,
            countUserReportCreations: this.countUserReportCreations,
            countUserPdfDownloads: this.countUserPdfDownloads,
            countUserNameSearches: this.countUserNameSearches,
        };
        optOut = {
            search: this.searchOptOut,
            request: this.requestOptOut,
            confirmation: this.confirmationOptOut,
        };
        billing = {
            sale: this.sale,
            tokenSale: this.tokenSale,
            signup: this.billingSignup,
            getOrders: this.getUserOrders,
            getActivatedProductTypes: this.getActivatedProductTypes,
            cancelOrUncancelOrder: this.cancelOrUncancelUserOrder,
        };
        offer = {
            findByShmName: this.findOfferByShmName,
        };
        shape = {
            setShapeParams: this.setShapeParams,
            getShapeCompiled: this.getShapeCompiled,
        };
        message = {
            contact: {
                create: this.createContactMessage,
                reply: this.replyContactMessage,
                histories: this.getContactMessageHistories,
            },
        };
        managedContact = {
            create: this.createManagedContact,
            unsubscribeMail: this.unsubscribeManagedContactMail,
        };
        tracking = {
            create: this.createTracking,
        };
    }

    const ApiWrapperError = {
        ERROR_CLIENT_00: '[ERROR_CLIENT_00] Cannot initialize without config.',
    };

    class ApiWrapperCaptcha {
        constructor(params) {
            this.request = params.request;
        }
        request;
        captchaIdHeaderKey = 'x-captcha-id';
        async makeCaptchaRetryRequest(error) {
            const originalRequest = error.config;
            try {
                const captchaData = error.response.data;
                const resolvedCaptcha = await this.executeCaptcha({
                    captchaType: captchaData?.type,
                    dynamicData: captchaData?.dynamicData,
                    siteKey: captchaData?.siteKey,
                });
                const response = await this.verifyCaptcha({
                    captchaData,
                    token: resolvedCaptcha.token,
                });
                originalRequest.headers = {
                    ...originalRequest.headers,
                    [this.captchaIdHeaderKey]: captchaData?.captchaId,
                };
                console.debug('captcha/verify response', response);
            }
            catch (e) {
                console.debug('captcha/verify error', e);
                // If captcha verification fails or an error occurs,
                // the next request will continue.
            }
            return originalRequest;
        }
        async executeCaptcha(params) {
            switch (params.captchaType) {
                case 'turnstile.v0':
                    return await this.executeTurnstile(params);
                case 'password.v0':
                    return await this.executePasswordCaptcha();
                case 'dynamicCaptcha.v1':
                    return await this.executeDynamicCaptcha({
                        dynamicData: params.dynamicData,
                    });
                default:
                    return { token: '' };
            }
        }
        async verifyCaptcha(params) {
            try {
                const response = await this.request({
                    url: '/captcha/verify',
                    method: 'get',
                    params: {
                        token: params.token,
                        type: params.captchaData?.type,
                        step: params.captchaData?.step,
                    },
                    headers: {
                        [this.captchaIdHeaderKey]: params.captchaData?.captchaId,
                    },
                });
                return response;
            }
            catch (e) {
                console.debug('captcha/verify failed', e);
                return null;
            }
        }
        async executeTurnstile(params) {
            const token = await ApiWrapperModal.turnstileModal(params);
            return { token };
        }
        async executePasswordCaptcha() {
            const token = await ApiWrapperModal.promptModal({ message: 'Input Password', passwordFlag: true });
            return { token };
        }
        async executeDynamicCaptcha(params) {
            const token = await ApiWrapperModal.dynamicModal({
                dynamicData: params.dynamicData,
            });
            return { token };
        }
    }

    const contextKey = {
        sale: {
            name: {
                teaser: 'sale.name.teaser',
                teaserOptOut: 'sale.name.teaser-optOut',
                report: 'sale.name.report',
            },
            phone: {
                teaser: 'sale.phone.teaser',
                teaserOptOut: 'sale.phone.teaser-optOut',
                report: 'sale.phone.report',
            },
            email: {
                teaser: 'sale.email.teaser',
                teaserOptOut: 'sale.email.teaser-optOut',
                report: 'sale.email.report',
            },
        },
        member: {
            name: {
                teaser: 'member.name.teaser',
                teaserOptOut: 'member.name.teaser-optOut',
                report: 'member.name.report',
            },
            phone: {
                teaser: 'member.phone.teaser',
                teaserOptOut: 'member.phone.teaser-optOut',
                report: 'member.phone.report',
            },
            email: {
                teaser: 'member.email.teaser',
                teaserOptOut: 'member.email.teaser-optOut',
                report: 'member.email.report',
            },
        },
    };

    class ApiWrapperQueryHandler {
        value;
        constructor(value) {
            this.value = value;
        }
        static typeKey = 'awqh[type]';
        static valueKey = 'awqh[value]';
        static handlerName;
        static getHandler() {
            const params = new URLSearchParams(window.location.search);
            const type = params.get(ApiWrapperQueryHandler.typeKey);
            const value = params.get(ApiWrapperQueryHandler.valueKey);
            if (!type || !value) {
                return null;
            }
            switch (type) {
                case ApiWrapperQueryHandlerConfirmationOptOut.handlerName:
                    return new ApiWrapperQueryHandlerConfirmationOptOut(value);
                case ApiWrapperQueryHandlerConfirmationUnsubscribeMail.handlerName:
                    return new ApiWrapperQueryHandlerConfirmationUnsubscribeMail(value);
                default:
                    return null;
            }
        }
        removeQuery() {
            const url = new URL(window.location.href);
            url.searchParams.delete(ApiWrapperQueryHandler.typeKey);
            url.searchParams.delete(ApiWrapperQueryHandler.valueKey);
            window.history.replaceState({}, '', url);
        }
    }
    class ApiWrapperQueryHandlerConfirmationOptOut extends ApiWrapperQueryHandler {
        static handlerName = 'confirmationRequestOptOut';
        async execute(dependencies) {
            const confirm = await ApiWrapperModal.confirmationModal({ message: 'Would you like to opt out?' });
            if (confirm) {
                const result = await dependencies.api.optOut.confirmation({ value: this.value });
                if (result.isSuccess()) {
                    this.removeQuery();
                    await ApiWrapperModal.messageModal({
                        message: 'Your request has been processed.',
                    });
                }
                else {
                    await ApiWrapperModal.messageModal({
                        message: 'Your request failed. If the problem persists, please let us know.',
                    });
                }
            }
        }
    }
    class ApiWrapperQueryHandlerConfirmationUnsubscribeMail extends ApiWrapperQueryHandler {
        static handlerName = 'confirmationUnsubscribeMail';
        async execute(dependencies) {
            const confirm = await ApiWrapperModal.confirmationModal({ message: 'Would you like to unsubscribe from email?' });
            if (confirm) {
                const result = await dependencies.api.managedContact.unsubscribeMail({ value: this.value });
                if (result.isSuccess()) {
                    this.removeQuery();
                    await ApiWrapperModal.messageModal({
                        message: 'Your request has been processed.',
                    });
                }
                else {
                    await ApiWrapperModal.messageModal({
                        message: 'Your request failed. If the problem persists, please let us know.',
                    });
                }
            }
        }
    }

    const localStorageKey = {
        markPathHistories: 'apiWrapper.markPathHistories',
    };
    function set(key, value) {
        if (value !== undefined) {
            const jsonString = JSON.stringify(value);
            localStorage.setItem(key, jsonString);
        }
    }
    function get(key) {
        const value = localStorage.getItem(key);
        return value === null ? null : JSON.parse(value);
    }
    function remove(key) {
        localStorage.removeItem(key);
    }
    const localStorageHelper = {
        set,
        get,
        remove,
    };

    class UrlHistoryTracker {
        option;
        constructor(option) {
            this.option = option;
            this.patchHistoryApi();
            this.initEventListeners();
            this.handleNavigationEnd();
        }
        markPathStorageKey = localStorageKey.markPathHistories;
        maxMarkPathList = 50;
        markPath(path) {
            const markPathList = this.getMarkPathList();
            if (markPathList.includes(path)) {
                return;
            }
            else {
                markPathList.push(path);
                localStorageHelper.set(this.markPathStorageKey, markPathList.slice(0, this.maxMarkPathList));
            }
        }
        isMarkedPath(path) {
            const markPathList = this.getMarkPathList();
            return markPathList.includes(path);
        }
        getMarkPathList() {
            const markPathFromStorage = localStorageHelper.get(this.markPathStorageKey);
            if (!markPathFromStorage) {
                return [];
            }
            return markPathFromStorage;
        }
        patchHistoryApi() {
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            history.pushState = function (...args) {
                const result = originalPushState.apply(this, args);
                window.dispatchEvent(new Event('pushstate'));
                return result;
            };
            history.replaceState = function (...args) {
                const result = originalReplaceState.apply(this, args);
                window.dispatchEvent(new Event('replacestate'));
                return result;
            };
        }
        initEventListeners() {
            window.addEventListener('popstate', () => this.handleNavigationEnd());
            window.addEventListener('pushstate', () => this.handleNavigationEnd());
            window.addEventListener('replacestate', () => this.handleNavigationEnd());
        }
        handleNavigationEnd() {
            const url = new URL(window.location.href);
            this.option?.navigationEndCallback?.({
                path: url.pathname,
            });
        }
    }

    function processBeforeUpload(file) {
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        const QUALITY = 0.5;
        const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']; // image/gif animation (gif.js, ffmpeg.wasm)
        if (!file.type.startsWith('image/') || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return Promise.resolve(file);
        }
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                let targetWidth = img.width;
                let targetHeight = img.height;
                if (targetWidth > MAX_WIDTH || targetHeight > MAX_HEIGHT) {
                    const widthRatio = MAX_WIDTH / targetWidth;
                    const heightRatio = MAX_HEIGHT / targetHeight;
                    const ratio = Math.min(widthRatio, heightRatio);
                    targetWidth = Math.round(targetWidth * ratio);
                    targetHeight = Math.round(targetHeight * ratio);
                }
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('No CanvasContext.'));
                }
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                const outputType = file.type === 'image/png' ? 'image/jpeg' : file.type;
                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFileName = outputType === 'image/jpeg' ? file.name.replace(/\.[^/.]+$/, '.jpg') : file.name;
                        const newFile = new File([blob], newFileName, {
                            type: outputType,
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    }
                    else {
                        reject(new Error('Failed to transform.'));
                    }
                }, outputType, QUALITY);
            };
            img.onerror = (error) => reject(error);
        });
    }
    const imageHelper = {
        processBeforeUpload,
    };

    class ApiWrapper {
        constructor(config) {
            this.initializedPromise = new Promise((resolve) => {
                this.resolveInitialize = resolve;
            });
            this.config = config;
            this.clientId = this.getRandomId();
            this.axiosWithInterceptor = axios.create({ baseURL: this.config.endpointUrl });
            this.axiosWithInterceptor.interceptors.request.use((config) => this.handleRequest(config), null);
            this.axiosWithInterceptor.interceptors.response.use(null, (error) => this.handleResponseError(error));
            this.axios = axios.create({ baseURL: this.config.endpointUrl });
            this.axios.interceptors.request.use((config) => this.handleRequest(config), null);
            this.api = new ApiWrapperApi({ request: (config) => this.axiosWithInterceptor.request(config) });
            this.api.shape.setShapeParams(this.config.initialShParams);
            this.captcha = new ApiWrapperCaptcha({ request: (config) => this.axios.request(config) });
            this.urlHistoryTracker = new UrlHistoryTracker({
                navigationEndCallback: this.handleUrlHistoryTrackerNavigationEnd.bind(this),
            });
            document.addEventListener('DOMContentLoaded', this.handleDOMLoaded.bind(this));
        }
        api;
        captcha;
        axiosWithInterceptor;
        axios;
        config;
        urlHistoryTracker;
        clientId;
        settings = {
            maxRetries: 10,
        };
        initializedPromise;
        resolveInitialize;
        static instance;
        static contextKey = contextKey;
        static imageHelper = imageHelper;
        static getInstance(config) {
            if (!ApiWrapper.instance) {
                if (!config) {
                    throw new Error(ApiWrapperError.ERROR_CLIENT_00);
                }
                ApiWrapper.instance = new ApiWrapper(config);
            }
            return ApiWrapper.instance;
        }
        onInitialize() {
            return this.initializedPromise;
        }
        goPage(page, option) {
            const apiId = this.getRandomId();
            let path = '';
            if (page === 'optOut') {
                path = `/api/optOut/view/search?clientId=${this.clientId}&apiId=${apiId}`;
            }
            if (!path) {
                console.error(`Cannot navigate to an unspecified page. (page: ${page})`);
                return;
            }
            if (option?.newPage) {
                window.open(path, '_blank', 'noopener,noreferrer');
            }
            else {
                window.location.href = path;
            }
        }
        handleRequest(config) {
            config.params = {
                ...config.params,
                clientId: this.clientId,
                apiId: this.getRandomId(),
            };
            config.__requestCallback?.(config);
            return config;
        }
        getRandomId() {
            return stringHelper.generateRandom(32);
        }
        async handleResponseError(error) {
            try {
                this.guardRetryResponseError(error);
            }
            catch (e) {
                return Promise.reject(e);
            }
            if (this.isRequestCaptchaError(error)) {
                const retryRequest = await this.captcha.makeCaptchaRetryRequest(error);
                return this.axiosWithInterceptor(retryRequest);
            }
            this.showErrorMessageModalOrNot(error);
            return Promise.reject(error);
        }
        isRequestCaptchaError(error) {
            return error?.response?.status === 412;
        }
        isCaptchaFailedError(error) {
            return error?.response?.status === 401 && error?.response?.data?.verifyCaptchaFailed;
        }
        guardRetryResponseError(error) {
            // error.config is response from axios
            const req = error.config;
            if (req['_retry'] >= this.settings.maxRetries) {
                throw error;
            }
            req['_retry'] = typeof req['_retry'] === 'number' ? req['_retry'] + 1 : 0;
        }
        showErrorMessageModalOrNot(error) {
            let message = '';
            if (this.isCaptchaFailedError(error)) {
                message = 'Captcha verification failed. The requested feature is not available.';
            }
            if (message) {
                ApiWrapperModal.messageModal({ message });
            }
        }
        async handleDOMLoaded() {
            await this.applyClientInit();
            this.resolveInitialize();
            const handler = ApiWrapperQueryHandler.getHandler();
            if (handler) {
                try {
                    await handler.execute({ api: this.api });
                }
                catch (e) {
                    console.error('Failed to execute query handler.', e);
                }
            }
        }
        async applyClientInit() {
            try {
                const shapeCompiled = await this.api.shape.getShapeCompiled();
                const header = shapeCompiled.getShComp('comp.client.init.header');
                if (header) {
                    this.injectHTMLAndRunScripts(document.head, header);
                }
                const body = shapeCompiled.getShComp('comp.client.init.body');
                if (body) {
                    this.injectHTMLAndRunScripts(document.body, body);
                }
            }
            catch (e) {
                console.error('Failed to apply ClientInit.', e);
            }
        }
        injectHTMLAndRunScripts(target, htmlString) {
            if (!htmlString) {
                return;
            }
            const template = document.createElement('template');
            template.innerHTML = htmlString;
            const scripts = template.content.querySelectorAll('script');
            scripts.forEach((oldScript) => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach((attr) => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.text = oldScript.text;
                oldScript.parentNode?.replaceChild(newScript, oldScript);
            });
            target.appendChild(template.content);
        }
        async handleUrlHistoryTrackerNavigationEnd(param) {
            try {
                const shapeCompiled = await this.api.shape.getShapeCompiled();
                const path = param.path.replace(/\//g, '.');
                const pixel = shapeCompiled.getShComp(`comp.client.pixel.iframe${path}`);
                const once = shapeCompiled.getShComp(`comp.client.pixel.iframe${path}.once`) === true;
                if (!pixel) {
                    return;
                }
                if (once && this.urlHistoryTracker.isMarkedPath(param.path)) {
                    return;
                }
                const iframe = document.createElement('iframe');
                iframe.srcdoc = pixel;
                iframe.tabIndex = -1;
                Object.assign(iframe.style, {
                    width: '1px',
                    height: '1px',
                    border: 'none',
                    margin: '0',
                    padding: '0',
                    overflow: 'hidden',
                    visibility: 'hidden',
                    position: 'absolute',
                });
                document.body.appendChild(iframe);
                if (once) {
                    this.urlHistoryTracker.markPath(param.path);
                }
            }
            catch (e) {
                console.error(e);
            }
        }
    }

    return ApiWrapper;

})(axios);
//# sourceMappingURL=index.iife.js.map
