Registry.require('helper');
    var Helper = Registry.get('helper');
    var _webRequest = {};
    
    var validScheme = function(url) {
        var extimg = Helper.isLocalImage(url);
        return (url && url.length > 4 && url.substr(0,4) == 'http') || extimg;
    };

    var xmlhttpRequest = function(details, callback, onreadychange, onerr, done, internal) {
        if (window.chrome != undefined &&
            window.chrome.xmlHttpRequest != undefined) {
            // Android ! :)
            window.chrome.xmlHttpRequest(details, callback);
            return;
        }
        var xmlhttp = new XMLHttpRequest();
        var createState = function() {
            var rh = '';
            var fu = details.url;
            if (xmlhttp.readyState > 2) {
                rh = xmlhttp.getAllResponseHeaders();
                if (xmlhttp.readyState == 4) {
                    if (rh) {
                        rh = rh.replace(/TM-finalURL\: .*[\r\n]{1,2}/, '');
                    }
                    var fi = xmlhttp.getResponseHeader('TM-finalURL');
                    if (fi) fu = fi;
                }
            }
            var o = {
                readyState: xmlhttp.readyState,
                responseHeaders: rh,
                finalUrl : fu,
                status: (xmlhttp.readyState == 4 ? xmlhttp.status : 0),
                statusText: (xmlhttp.readyState == 4 ? xmlhttp.statusText : '')
            };
            if (xmlhttp.readyState == 4) {
                if (!xmlhttp.responseType || xmlhttp.responseType == '') {
                    o.responseXML = (xmlhttp.responseXML ? escape(xmlhttp.responseXML) : null);
                    o.responseText = xmlhttp.responseText;
                    o.response = xmlhttp.response;
                } else {
                    o.responseXML = null;
                    o.responseText = null;
                    o.response = xmlhttp.response;
                }
            } else {
                o.responseXML = null;
                o.responseText = '';
                o.response = null;
            }
            return o;
        };
        var onload = function() {
            var responseState = createState();
            if (responseState.readyState == 4 &&
                responseState.status != 200 &&
                responseState.status != 0 &&
                details.retries > 0) {
                details.retries--;
                // console.log("bg: error at onload, should not happen! -> retry :)")
                xmlhttpRequest(details, callback, onreadychange, onerr, done, internal);
                return;
            }
            if (callback) callback(responseState);
            if (done) done();
        };
        var onerror = function() {
            var responseState = createState();
            if (responseState.readyState == 4 &&
                responseState.status != 200 &&
                responseState.status != 0 &&
                details.retries > 0) {
                details.retries--;
                xmlhttpRequest(details, callback, onreadychange, onerr, done, internal);
                return;
            }
            if (onerr) {
                onerr(responseState);
            } else if (callback) {
                callback(responseState);
            }
            if (done) done();
            delete xmlhttp;
        };
        var onreadystatechange = function(c) {
            var responseState = createState();
            if (onreadychange) {
                try {
                    if (c.lengthComputable || c.totalSize > 0 ) {
                        responseState.progress = { total: c.total,  totalSize: c.totalSize };
                    } else {
                        var t = Number(Helper.getStringBetweenTags(responseState.responseHeaders, 'Content-Length:', '\n').trim());
                        var l = xmlhttp.responseText ? xmlhttp.responseText.length : 0;
                        if (t > 0) {
                            responseState.progress = { total: l,  totalSize: t };
                        }
                    }
                } catch (e) {}
                onreadychange(responseState);
            }
        };
        xmlhttp.onload = onload;
        xmlhttp.onerror = onerror;
        xmlhttp.onreadystatechange = onreadystatechange;
        try {
            if (!internal && !validScheme(details.url)) {
                throw new Error("Invalid scheme of url: " + details.url);
            }
            xmlhttp.open(details.method, details.url);
            if (details.headers) {
                for (var prop in details.headers) {
                    var p = prop;
                    if (_webRequest.use && (prop.toLowerCase() == "user-agent" || prop.toLowerCase() == "referer"))  {
                        p = _webRequest.prefix + prop;
                    }
                    xmlhttp.setRequestHeader(p, details.headers[prop]);
                }
            }
            if (typeof(details.overrideMimeType) !== 'undefined') {
                xmlhttp.overrideMimeType(details.overrideMimeType);
            }
            if (typeof(details.responseType) !== 'undefined') {
                xmlhttp.responseType = details.responseType;
            }
            if (typeof(details.data) !== 'undefined') {
                xmlhttp.send(details.data);
            } else {
                xmlhttp.send();
            }
        } catch(e) {
            console.log("xhr: error: " + e.message);
            if(callback) {
                var resp = { responseXML: '',
                             responseText: '',
                             response: null,
                             readyState: 4,
                             responseHeaders: '',
                             status: 403,
                             statusText: 'Forbidden'};
                callback(resp);
            }
            if (done) done();
        }
    };

    var setWebRequest = function(wr) {
        _webRequest = wr;
    };
        
    Registry.register('xmlhttprequest', { run : xmlhttpRequest, setWebRequest: setWebRequest });

var solved = false;
    var checkBoxClicked = false;
    var waitingForAudioResponse = false;
    //Node Selectors
    const CHECK_BOX = ".recaptcha-checkbox-border";
    const AUDIO_BUTTON = "#recaptcha-audio-button";
    const PLAY_BUTTON = ".rc-audiochallenge-play-button .rc-button-default";
    const AUDIO_SOURCE = "#audio-source";
    const IMAGE_SELECT = "#rc-imageselect";
    const RESPONSE_FIELD = ".rc-audiochallenge-response-field";
    const AUDIO_ERROR_MESSAGE = ".rc-audiochallenge-error-message";
    const AUDIO_RESPONSE = "#audio-response";
    const RELOAD_BUTTON = "#recaptcha-reload-button";
    const RECAPTCHA_STATUS = "#recaptcha-accessible-status";
    const DOSCAPTCHA = ".rc-doscaptcha-body";
    const VERIFY_BUTTON = "#recaptcha-verify-button";
    const MAX_ATTEMPTS = 5;
    var requestCount = 0;
    var recaptchaLanguage = qSelector("html").getAttribute("lang");
    var audioUrl = "";
    var recaptchaInitialStatus = qSelector(RECAPTCHA_STATUS) ? qSelector(RECAPTCHA_STATUS).innerText : ""
    var serversList = ["https://engageub.pythonanywhere.com","https://engageub1.pythonanywhere.com"];
    var latencyList = Array(serversList.length).fill(10000);
    //Check for visibility && Click the check box
    function isHidden(el) {
        return(el.offsetParent === null)
    }
 
    async function getTextFromAudio(URL) {
        var minLatency = 100000;
        var url = "";
 
        //Selecting the last/latest server by default if latencies are equal
        for(let k=0; k< latencyList.length;k++){
            if(latencyList[k] <= minLatency){
                minLatency = latencyList[k];
                url = serversList[k];
            }
        }
 
        requestCount = requestCount + 1;
        URL = URL.replace("recaptcha.net", "google.com");
        if(recaptchaLanguage.length < 1) {
            console.log("Recaptcha Language is not recognized");
            recaptchaLanguage = "en-US";
        }
        console.log("Recaptcha Language is " + recaptchaLanguage);
 
        GM_xmlhttpRequest({
            method: "POST",
            url: url,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data: "input=" + encodeURIComponent(URL) + "&lang=" + recaptchaLanguage,
            timeout: 60000,
            onload: function(response) {
                console.log("Response::" + response.responseText);
                try {
                    if(response && response.responseText) {
                        var responseText = response.responseText;
                        //Validate Response for error messages or html elements
                        if(responseText == "0" || responseText.includes("<") || responseText.includes(">") || responseText.length < 2 || responseText.length > 50) {
                            //Invalid Response, Reload the captcha
                            console.log("Invalid Response. Retrying..");
                        } else if(qSelector(AUDIO_SOURCE) && qSelector(AUDIO_SOURCE).src && audioUrl == qSelector(AUDIO_SOURCE).src && qSelector(AUDIO_RESPONSE)
                                  && !qSelector(AUDIO_RESPONSE).value && qSelector(AUDIO_BUTTON).style.display == "none" && qSelector(VERIFY_BUTTON)) {
                            qSelector(AUDIO_RESPONSE).value = responseText;
                            qSelector(VERIFY_BUTTON).click();
                        } else {
                            console.log("Could not locate text input box")
                        }
                        waitingForAudioResponse = false;
                    }
 
                } catch(err) {
                    console.log(err.message);
                    console.log("Exception handling response. Retrying..");
                    waitingForAudioResponse = false;
                }
            },
            onerror: function(e) {
                console.log(e);
                waitingForAudioResponse = false;
            },
            ontimeout: function() {
                console.log("Response Timed out. Retrying..");
                waitingForAudioResponse = false;
            },
        });
    }
 
 
    async function pingTest(url) {
        var start = new Date().getTime();
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data: "",
            timeout: 8000,
            onload: function(response) {
 
                if(response && response.responseText && response.responseText=="0") {
                    var end = new Date().getTime();
                    var milliseconds = end - start;
 
                    // For large values use Hashmap
                    for(let i=0; i< serversList.length;i++){
                        if (url == serversList[i]) {
                            latencyList[i] = milliseconds;
                        }
                    }
                }
            },
            onerror: function(e) {
                console.log(e);
            },
            ontimeout: function() {
                console.log("Ping Test Response Timed out for " + url);
            },
        });
    }
 
 
    function qSelectorAll(selector) {
        return document.querySelectorAll(selector);
    }
 
    function qSelector(selector) {
        return document.querySelector(selector);
    }
 
 
 
    if(qSelector(CHECK_BOX)){
        qSelector(CHECK_BOX).click();
    } else if(window.location.href.includes("bframe")){
        for(let i=0; i< serversList.length;i++){
            pingTest(serversList[i]);
        }
    }
 
    //Solve the captcha using audio
    var startInterval = setInterval(function() {
        try {
            if(!checkBoxClicked && qSelector(CHECK_BOX) && !isHidden(qSelector(CHECK_BOX))) {
                //console.log("checkbox clicked");
                qSelector(CHECK_BOX).click();
                checkBoxClicked = true;
            }
            //Check if the captcha is solved
            if(qSelector(RECAPTCHA_STATUS) && (qSelector(RECAPTCHA_STATUS).innerText != recaptchaInitialStatus)) {
                solved = true;
                console.log("SOLVED");
                clearInterval(startInterval);
            }
            if(requestCount > MAX_ATTEMPTS) {
                console.log("Attempted Max Retries. Stopping the solver");
                solved = true;
                clearInterval(startInterval);
            }
            if(!solved) {
                if(qSelector(AUDIO_BUTTON) && !isHidden(qSelector(AUDIO_BUTTON)) && qSelector(IMAGE_SELECT)) {
                    // console.log("Audio button clicked");
                    qSelector(AUDIO_BUTTON).click();
                }
                if((!waitingForAudioResponse && qSelector(AUDIO_SOURCE) && qSelector(AUDIO_SOURCE).src
                    && qSelector(AUDIO_SOURCE).src.length > 0 && audioUrl == qSelector(AUDIO_SOURCE).src
                    && qSelector(RELOAD_BUTTON)) ||
                   (qSelector(AUDIO_ERROR_MESSAGE) && qSelector(AUDIO_ERROR_MESSAGE).innerText.length > 0 && qSelector(RELOAD_BUTTON) &&
                    !qSelector(RELOAD_BUTTON).disabled)){
                    qSelector(RELOAD_BUTTON).click();
                } else if(!waitingForAudioResponse && qSelector(RESPONSE_FIELD) && !isHidden(qSelector(RESPONSE_FIELD))
                          && !qSelector(AUDIO_RESPONSE).value && qSelector(AUDIO_SOURCE) && qSelector(AUDIO_SOURCE).src
                          && qSelector(AUDIO_SOURCE).src.length > 0 && audioUrl != qSelector(AUDIO_SOURCE).src
                          && requestCount <= MAX_ATTEMPTS) {
                    waitingForAudioResponse = true;
                    audioUrl = qSelector(AUDIO_SOURCE).src
                    getTextFromAudio(audioUrl);
                }else {
                    //Waiting
                }
            }
            //Stop solving when Automated queries message is shown
            if(qSelector(DOSCAPTCHA) && qSelector(DOSCAPTCHA).innerText.length > 0) {
                console.log("Automated Queries Detected");
                clearInterval(startInterval);
            }
        } catch(err) {
            console.log(err.message);
            console.log("An error occurred while solving. Stopping the solver.");
            clearInterval(startInterval);
        }
    }, 5000);
