"use strict";

/* =========================================
   ENDPOINTS DEL BACKEND
========================================= */

const CHAT_API_URL =
    "https://traductor-inteligente-multimodal.vercel.app/api/chat";

const AUDIO_API_URL =
    "https://traductor-inteligente-multimodal.vercel.app/api/audio";

const DOCUMENT_API_URL =
    "https://traductor-inteligente-multimodal.vercel.app/api/documents";

const IMAGE_API_URL =
    "https://traductor-inteligente-multimodal.vercel.app/api/images";


/* =========================================
   ADMINISTRADOR DE ESTADOS
========================================= */

class StatusManager {

    static show(containerId, type, message) {

        const container =
            document.getElementById(containerId);

        if (!container) {
            return;
        }

        const icons = {
            success: "✓",
            warning: "⚠",
            error: "✕",
            loading: "⏳"
        };

        container.innerHTML = "";

        const element =
            document.createElement("div");

        element.className =
            `status-message status-${type}`;

        element.textContent =
            `${icons[type] || ""} ${message}`;

        container.appendChild(element);
    }


    static clear(containerId) {

        const container =
            document.getElementById(containerId);

        if (container) {
            container.innerHTML = "";
        }
    }
}


/* =========================================
   UTILIDADES
========================================= */

class AppUtils {

    static getLanguageName(language) {

        const languages = {
            es: "Español",
            en: "Inglés"
        };

        return (
            languages[language] ||
            language ||
            "Idioma desconocido"
        );
    }


    static async readJson(response) {

        try {

            return await response.json();

        } catch {

            throw new Error(
                "El servidor devolvió una respuesta no válida."
            );
        }
    }


    static async copyText(
        text,
        button,
        statusId
    ) {

        const cleanText =
            String(text || "").trim();


        if (!cleanText) {

            StatusManager.show(
                statusId,
                "warning",
                "No hay texto disponible para copiar."
            );

            return;
        }


        try {

            await navigator.clipboard.writeText(
                cleanText
            );


            const originalButtonText =
                button.textContent;


            button.textContent =
                "✓ Copiado";


            button.classList.add(
                "copied"
            );


            setTimeout(
                () => {

                    button.textContent =
                        originalButtonText;


                    button.classList.remove(
                        "copied"
                    );
                },
                1500
            );

        } catch (error) {

            console.error(
                "Error al copiar:",
                error
            );


            StatusManager.show(
                statusId,
                "error",
                "No fue posible copiar el texto."
            );
        }
    }
}


/* =========================================
   MÓDULO DE CHAT
========================================= */

class ChatModule {

    constructor() {

        this.form =
            document.getElementById(
                "chatForm"
            );


        this.messageInput =
            document.getElementById(
                "messageInput"
            );


        this.characterCounter =
            document.getElementById(
                "characterCounter"
            );


        this.participantSelect =
            document.getElementById(
                "participantSelect"
            );


        this.messages =
            document.getElementById(
                "chatMessages"
            );


        this.sendButton =
            document.getElementById(
                "sendMessageButton"
            );


        this.clearChatButton =
            document.getElementById(
                "clearChatButton"
            );


        this.maxCharacters =
            1000;


        this.storageKey =
            "translatorChatHistory";


        this.history =
            [];


        this.init();
    }


    init() {

        if (
            !this.form ||
            !this.messageInput ||
            !this.messages
        ) {

            return;
        }


        this.messageInput.addEventListener(
            "input",
            () => {

                this.updateCharacterCounter();
            }
        );


        this.form.addEventListener(
            "submit",
            (event) => {

                this.handleSubmit(
                    event
                );
            }
        );


        if (this.clearChatButton) {

            this.clearChatButton.addEventListener(
                "click",
                () => {

                    this.clearChat();
                }
            );
        }


        this.loadHistory();


        this.updateCharacterCounter();
    }


    /* =====================================
       CONTADOR DE CARACTERES
    ===================================== */

    updateCharacterCounter() {

        if (
            !this.characterCounter ||
            !this.messageInput
        ) {

            return;
        }


        this.characterCounter.textContent =
            this.messageInput.value.length;
    }


    /* =====================================
       ENVIAR MENSAJE
    ===================================== */

    async handleSubmit(event) {

        event.preventDefault();


        const message =
            this.messageInput
                .value
                .trim();


        if (!message) {

            StatusManager.show(
                "chatStatus",
                "warning",
                "Escribe un mensaje antes de enviarlo."
            );


            this.messageInput.focus();


            return;
        }


        if (
            message.length >
            this.maxCharacters
        ) {

            StatusManager.show(
                "chatStatus",
                "error",
                `El mensaje no puede superar ${this.maxCharacters} caracteres.`
            );


            return;
        }


        const participant =
            this.participantSelect
                ? this.participantSelect.value
                : "participant1";


        try {

            this.setLoading(
                true
            );


            StatusManager.show(
                "chatStatus",
                "loading",
                "Traduciendo mensaje..."
            );


            const response =
                await fetch(
                    CHAT_API_URL,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                message
                            })
                    }
                );


            const data =
                await AppUtils.readJson(
                    response
                );


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No fue posible realizar la traducción."
                );
            }


            if (
                !data.original ||
                !data.translation ||
                !data.source_language ||
                !data.target_language
            ) {

                throw new Error(
                    "La respuesta de traducción está incompleta."
                );
            }


            const historyItem = {

                participant,

                original:
                    data.original,

                translation:
                    data.translation,

                sourceLanguage:
                    data.source_language,

                targetLanguage:
                    data.target_language
            };


            this.addMessage(
                historyItem
            );


            this.saveMessage(
                historyItem
            );


            this.messageInput.value =
                "";


            this.updateCharacterCounter();


            StatusManager.show(
                "chatStatus",
                "success",
                "Mensaje traducido correctamente."
            );


            this.messageInput.focus();

        } catch (error) {

            console.error(
                "Error al traducir mensaje:",
                error
            );


            StatusManager.show(
                "chatStatus",
                "error",
                error.message ||
                "No fue posible conectar con el servicio de traducción."
            );

        } finally {

            this.setLoading(
                false
            );
        }
    }


    /* =====================================
       MOSTRAR MENSAJE
    ===================================== */

    addMessage({
        participant,
        original,
        translation,
        sourceLanguage,
        targetLanguage
    }) {

        const placeholder =
            this.messages.querySelector(
                ".text-center.text-secondary"
            );


        if (placeholder) {

            placeholder.remove();
        }


        const messageContainer =
            document.createElement(
                "div"
            );


        messageContainer.classList.add(
            "chat-message"
        );


        messageContainer.classList.add(
            participant ===
                "participant1"
                ? "participant-1"
                : "participant-2"
        );


        /* PARTICIPANTE */

        const participantElement =
            document.createElement(
                "div"
            );


        participantElement.className =
            "message-participant";


        participantElement.textContent =
            participant ===
                "participant1"
                ? "Participante 1"
                : "Participante 2";


        /* TEXTO ORIGINAL */

        const originalElement =
            document.createElement(
                "div"
            );


        originalElement.className =
            "message-original";


        const originalLabel =
            document.createElement(
                "strong"
            );


        originalLabel.textContent =
            `Original (${AppUtils.getLanguageName(sourceLanguage)}):`;


        originalElement.appendChild(
            originalLabel
        );


        originalElement.appendChild(
            document.createElement(
                "br"
            )
        );


        originalElement.appendChild(
            document.createTextNode(
                original
            )
        );


        /* TRADUCCIÓN */

        const translationElement =
            document.createElement(
                "div"
            );


        translationElement.className =
            "message-translation";


        const translationLabel =
            document.createElement(
                "strong"
            );


        translationLabel.textContent =
            `Traducción (${AppUtils.getLanguageName(targetLanguage)}):`;


        translationElement.appendChild(
            translationLabel
        );


        translationElement.appendChild(
            document.createElement(
                "br"
            )
        );


        translationElement.appendChild(
            document.createTextNode(
                translation
            )
        );


        /* BOTONES DE COPIAR */

        const copyButtonsContainer =
            document.createElement(
                "div"
            );


        copyButtonsContainer.className =
            "d-flex flex-wrap gap-2 mt-3";


        const copyOriginalButton =
            document.createElement(
                "button"
            );


        copyOriginalButton.type =
            "button";


        copyOriginalButton.className =
            "copy-translation-button";


        copyOriginalButton.textContent =
            "📋 Copiar original";


        copyOriginalButton.addEventListener(
            "click",
            () => {

                AppUtils.copyText(
                    original,
                    copyOriginalButton,
                    "chatStatus"
                );
            }
        );


        const copyTranslationButton =
            document.createElement(
                "button"
            );


        copyTranslationButton.type =
            "button";


        copyTranslationButton.className =
            "copy-translation-button";


        copyTranslationButton.textContent =
            "📋 Copiar traducción";


        copyTranslationButton.addEventListener(
            "click",
            () => {

                AppUtils.copyText(
                    translation,
                    copyTranslationButton,
                    "chatStatus"
                );
            }
        );


        copyButtonsContainer.appendChild(
            copyOriginalButton
        );


        copyButtonsContainer.appendChild(
            copyTranslationButton
        );


        messageContainer.appendChild(
            participantElement
        );


        messageContainer.appendChild(
            originalElement
        );


        messageContainer.appendChild(
            translationElement
        );


        messageContainer.appendChild(
            copyButtonsContainer
        );


        this.messages.appendChild(
            messageContainer
        );


        this.messages.scrollTop =
            this.messages.scrollHeight;
    }


    /* =====================================
       ESTADO DEL BOTÓN
    ===================================== */

    setLoading(isLoading) {

        if (!this.sendButton) {

            return;
        }


        this.sendButton.disabled =
            isLoading;


        this.sendButton.textContent =
            isLoading
                ? "Traduciendo..."
                : "Traducir y enviar";
    }


    /* =====================================
       GUARDAR HISTORIAL
    ===================================== */

    saveMessage(message) {

        this.history.push(
            message
        );


        try {

            sessionStorage.setItem(
                this.storageKey,
                JSON.stringify(
                    this.history
                )
            );

        } catch (error) {

            console.error(
                "No fue posible guardar el historial:",
                error
            );
        }
    }


    /* =====================================
       CARGAR HISTORIAL
    ===================================== */

    loadHistory() {

        const savedHistory =
            sessionStorage.getItem(
                this.storageKey
            );


        if (!savedHistory) {

            return;
        }


        try {

            const parsed =
                JSON.parse(
                    savedHistory
                );


            if (
                !Array.isArray(
                    parsed
                )
            ) {

                throw new Error(
                    "Historial inválido."
                );
            }


            this.history =
                parsed;


            this.history.forEach(
                (message) => {

                    this.addMessage(
                        message
                    );
                }
            );

        } catch (error) {

            console.error(
                "No fue posible cargar el historial:",
                error
            );


            this.history =
                [];


            sessionStorage.removeItem(
                this.storageKey
            );
        }
    }


    /* =====================================
       LIMPIAR CHAT
    ===================================== */

    clearChat() {

        if (
            this.history.length ===
            0
        ) {

            StatusManager.show(
                "chatStatus",
                "warning",
                "La conversación ya está vacía."
            );


            return;
        }


        const confirmed =
            window.confirm(
                "¿Deseas eliminar toda la conversación de esta sesión?"
            );


        if (!confirmed) {

            return;
        }


        this.history =
            [];


        sessionStorage.removeItem(
            this.storageKey
        );


        this.messages.innerHTML = `
            <div class="text-center text-secondary py-4">
                La conversación aparecerá aquí.
            </div>
        `;


        StatusManager.show(
            "chatStatus",
            "success",
            "La conversación se eliminó correctamente."
        );


        this.messageInput.focus();
    }
}


/* =========================================
   CLASE BASE PARA ARCHIVOS
========================================= */

class FileModule {

    constructor(config) {

        this.form =
            document.getElementById(
                config.formId
            );


        this.input =
            document.getElementById(
                config.inputId
            );


        this.fileName =
            document.getElementById(
                config.fileNameId
            );


        this.statusId =
            config.statusId;


        this.allowedExtensions =
            config.allowedExtensions ||
            [];


        this.maxSizeMB =
            config.maxSizeMB ||
            4;


        this.previewContainer =
            config.previewContainerId
                ? document.getElementById(
                    config.previewContainerId
                )
                : null;


        this.preview =
            config.previewId
                ? document.getElementById(
                    config.previewId
                )
                : null;


        this.clearButton =
            config.clearButtonId
                ? document.getElementById(
                    config.clearButtonId
                )
                : null;


        this.copyOriginalButton =
            config.copyOriginalButtonId
                ? document.getElementById(
                    config.copyOriginalButtonId
                )
                : null;


        this.copyTranslatedButton =
            config.copyTranslatedButtonId
                ? document.getElementById(
                    config.copyTranslatedButtonId
                )
                : null;


        this.originalText =
            config.originalTextId
                ? document.getElementById(
                    config.originalTextId
                )
                : null;


        this.translatedText =
            config.translatedTextId
                ? document.getElementById(
                    config.translatedTextId
                )
                : null;


        this.previewUrl =
            null;


        this.init();
    }


    init() {

        if (
            !this.input ||
            !this.form
        ) {

            return;
        }


        this.input.addEventListener(
            "change",
            () => {

                this.handleFileSelection();
            }
        );


        this.form.addEventListener(
            "submit",
            (event) => {

                this.handleSubmit(
                    event
                );
            }
        );


        if (this.clearButton) {

            this.clearButton.addEventListener(
                "click",
                () => {

                    this.clearModule();
                }
            );
        }


        if (this.copyOriginalButton) {

            this.copyOriginalButton.addEventListener(
                "click",
                () => {

                    AppUtils.copyText(
                        this.originalText?.textContent || "",
                        this.copyOriginalButton,
                        this.statusId
                    );
                }
            );
        }


        if (this.copyTranslatedButton) {

            this.copyTranslatedButton.addEventListener(
                "click",
                () => {

                    AppUtils.copyText(
                        this.translatedText?.textContent || "",
                        this.copyTranslatedButton,
                        this.statusId
                    );
                }
            );
        }
    }


    /* =====================================
       OBTENER EXTENSIÓN
    ===================================== */

    getExtension(fileName) {

        const parts =
            fileName
                .toLowerCase()
                .split(".");


        return (
            parts.length > 1
                ? parts.pop()
                : ""
        );
    }


    /* =====================================
       VALIDAR ARCHIVO
    ===================================== */

    validateFile(file) {

        if (!file) {

            return {

                valid:
                    false,

                message:
                    "Selecciona un archivo."
            };
        }


        const extension =
            this.getExtension(
                file.name
            );


        if (
            !this.allowedExtensions.includes(
                extension
            )
        ) {

            return {

                valid:
                    false,

                message:
                    "El formato del archivo no está permitido."
            };
        }


        if (
            file.size ===
            0
        ) {

            return {

                valid:
                    false,

                message:
                    "El archivo seleccionado está vacío."
            };
        }


        const maxBytes =
            this.maxSizeMB *
            1024 *
            1024;


        if (
            file.size >
            maxBytes
        ) {

            return {

                valid:
                    false,

                message:
                    `El archivo supera el límite de ${this.maxSizeMB} MB.`
            };
        }


        return {

            valid:
                true,

            message:
                "Archivo válido."
        };
    }


    /* =====================================
       ARCHIVO SELECCIONADO
    ===================================== */

    handleFileSelection() {

        StatusManager.clear(
            this.statusId
        );


        const file =
            this.input.files[0];


        if (!file) {

            this.resetFileName();


            this.hidePreview();


            return;
        }


        const validation =
            this.validateFile(
                file
            );


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );


            this.input.value =
                "";


            this.resetFileName();


            this.hidePreview();


            return;
        }


        if (this.fileName) {

            this.fileName.textContent =
                file.name;
        }


        StatusManager.show(
            this.statusId,
            "success",
            "Archivo seleccionado correctamente."
        );


        if (this.preview) {

            this.showImagePreview(
                file
            );
        }
    }


    /* =====================================
       ENVÍO GENÉRICO
    ===================================== */

    handleSubmit(event) {

        event.preventDefault();


        StatusManager.show(
            this.statusId,
            "warning",
            "Este tipo de archivo aún no tiene un módulo de procesamiento asignado."
        );
    }


    /* =====================================
       VISTA PREVIA DE IMAGEN
    ===================================== */

    showImagePreview(file) {

        if (
            !this.preview ||
            !this.previewContainer
        ) {

            return;
        }


        if (this.previewUrl) {

            URL.revokeObjectURL(
                this.previewUrl
            );
        }


        this.previewUrl =
            URL.createObjectURL(
                file
            );


        this.preview.src =
            this.previewUrl;


        this.previewContainer
            .classList
            .remove(
                "d-none"
            );
    }


    /* =====================================
       OCULTAR PREVIEW
    ===================================== */

    hidePreview() {

        if (
            !this.preview ||
            !this.previewContainer
        ) {

            return;
        }


        if (this.previewUrl) {

            URL.revokeObjectURL(
                this.previewUrl
            );


            this.previewUrl =
                null;
        }


        this.preview.removeAttribute(
            "src"
        );


        this.previewContainer
            .classList
            .add(
                "d-none"
            );
    }


    /* =====================================
       RESTAURAR NOMBRE DEL ARCHIVO
    ===================================== */

    resetFileName() {

        if (this.fileName) {

            this.fileName.textContent =
                "Ningún archivo seleccionado";
        }
    }


    /* =====================================
       LIMPIAR MÓDULO
    ===================================== */

    clearModule() {

        if (this.input) {

            this.input.value =
                "";
        }


        this.resetFileName();


        if (
            typeof this.hideResult ===
            "function"
        ) {

            this.hideResult();
        }


        this.hidePreview();


        StatusManager.clear(
            this.statusId
        );
    }
}


/* =========================================
   MÓDULO DE AUDIO
========================================= */

class AudioModule extends FileModule {

    constructor(config) {

        super(config);


        this.apiUrl =
            config.apiUrl;


        this.submitButton =
            document.getElementById(
                config.submitButtonId
            );


        this.resultContainer =
            document.getElementById(
                config.resultContainerId
            );


        this.originalText =
            document.getElementById(
                config.originalTextId
            );


        this.translatedText =
            document.getElementById(
                config.translatedTextId
            );


        this.audioPlayer =
            null;


        this.speechUrl =
            null;
    }


    /* =====================================
       ARCHIVO DE AUDIO SELECCIONADO
    ===================================== */

    handleFileSelection() {

        this.hideResult();


        super.handleFileSelection();
    }


    /* =====================================
       PROCESAR AUDIO
    ===================================== */

    async handleSubmit(event) {

        event.preventDefault();


        const file =
            this.input.files[0];


        if (!file) {

            StatusManager.show(
                this.statusId,
                "warning",
                "Selecciona un archivo de audio antes de continuar."
            );


            return;
        }


        const validation =
            this.validateFile(
                file
            );


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );


            return;
        }


        try {

            this.hideResult();


            this.setLoading(
                true
            );


            StatusManager.show(
                this.statusId,
                "loading",
                "Procesando, transcribiendo y traduciendo el audio..."
            );


            const formData =
                new FormData();


            formData.append(
                "audio",
                file,
                file.name
            );


            const response =
                await fetch(
                    this.apiUrl,
                    {
                        method:
                            "POST",

                        body:
                            formData
                    }
                );


            const data =
                await AppUtils.readJson(
                    response
                );


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No fue posible procesar el audio."
                );
            }


            if (
                !data.transcription ||
                !data.translation
            ) {

                throw new Error(
                    "La respuesta del audio está incompleta."
                );
            }


            this.originalText.textContent =
                data.transcription;


            this.translatedText.textContent =
                data.translation;


            this.resultContainer
                .classList
                .remove(
                    "d-none"
                );


            StatusManager.show(
                this.statusId,
                "loading",
                "Generando la traducción hablada..."
            );


            try {

                await this.generateSpeech(
                    data.translation,
                    data.target_language
                );


                StatusManager.show(
                    this.statusId,
                    "success",
                    `Audio traducido correctamente: ${AppUtils.getLanguageName(data.source_language)} → ${AppUtils.getLanguageName(data.target_language)}.`
                );

            } catch (speechError) {

                console.error(
                    "Error generando voz:",
                    speechError
                );


                StatusManager.show(
                    this.statusId,
                    "warning",
                    "La transcripción y traducción se completaron, pero no fue posible generar la voz traducida."
                );
            }

        } catch (error) {

            console.error(
                "Error procesando audio:",
                error
            );


            this.hideResult();


            StatusManager.show(
                this.statusId,
                "error",
                error.message ||
                "No fue posible conectar con el servicio de audio."
            );

        } finally {

            this.setLoading(
                false
            );
        }
    }


    /* =====================================
       GENERAR AUDIO TRADUCIDO
    ===================================== */

    async generateSpeech(
        text,
        targetLanguage
    ) {

        const response =
            await fetch(
                this.apiUrl,
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            action:
                                "speech",

                            text,

                            target_language:
                                targetLanguage
                        })
                }
            );


        if (!response.ok) {

            let message =
                "No fue posible generar la voz traducida.";


            try {

                const data =
                    await response.json();


                message =
                    data.error ||
                    message;

            } catch {

                // Se conserva el mensaje genérico.
            }


            throw new Error(
                message
            );
        }


        const audioBlob =
            await response.blob();


        if (
            !audioBlob ||
            audioBlob.size ===
                0
        ) {

            throw new Error(
                "El audio traducido recibido está vacío."
            );
        }


        this.ensureAudioPlayer();


        if (this.speechUrl) {

            URL.revokeObjectURL(
                this.speechUrl
            );
        }


        this.speechUrl =
            URL.createObjectURL(
                audioBlob
            );


        this.audioPlayer.src =
            this.speechUrl;


        this.audioPlayer.load();
    }


    /* =====================================
       CREAR REPRODUCTOR
    ===================================== */

    ensureAudioPlayer() {

        if (
            this.audioPlayer ||
            !this.resultContainer
        ) {

            return;
        }


        const playerContainer =
            document.createElement(
                "div"
            );


        playerContainer.id =
            "audioPlaybackContainer";


        playerContainer.className =
            "mt-3 border rounded p-3";


        const title =
            document.createElement(
                "h4"
            );


        title.className =
            "h6 fw-bold";


        title.textContent =
            "Traducción hablada";


        const audio =
            document.createElement(
                "audio"
            );


        audio.id =
            "translatedAudioPlayer";


        audio.controls =
            true;


        audio.preload =
            "metadata";


        audio.className =
            "w-100";


        playerContainer.appendChild(
            title
        );


        playerContainer.appendChild(
            audio
        );


        this.resultContainer.appendChild(
            playerContainer
        );


        this.audioPlayer =
            audio;
    }


    /* =====================================
       OCULTAR RESULTADO AUDIO
    ===================================== */

    hideResult() {

        if (this.resultContainer) {

            this.resultContainer
                .classList
                .add(
                    "d-none"
                );
        }


        if (this.originalText) {

            this.originalText.textContent =
                "";
        }


        if (this.translatedText) {

            this.translatedText.textContent =
                "";
        }


        if (this.speechUrl) {

            URL.revokeObjectURL(
                this.speechUrl
            );


            this.speechUrl =
                null;
        }


        if (this.audioPlayer) {

            this.audioPlayer.pause();


            this.audioPlayer.removeAttribute(
                "src"
            );


            this.audioPlayer.load();
        }
    }


    /* =====================================
       ESTADO BOTÓN AUDIO
    ===================================== */

    setLoading(isLoading) {

        if (!this.submitButton) {

            return;
        }


        this.submitButton.disabled =
            isLoading;


        this.submitButton.textContent =
            isLoading
                ? "Procesando..."
                : "Traducir audio";
    }
}


/* =========================================
   MÓDULO DE DOCUMENTOS
========================================= */

class DocumentModule extends FileModule {

    constructor(config) {

        super(config);


        this.apiUrl =
            config.apiUrl;


        this.submitButton =
            document.getElementById(
                config.submitButtonId
            );


        this.resultContainer =
            document.getElementById(
                config.resultContainerId
            );


        this.originalText =
            document.getElementById(
                config.originalTextId
            );


        this.translatedText =
            document.getElementById(
                config.translatedTextId
            );
    }


    /* =====================================
       DOCUMENTO SELECCIONADO
    ===================================== */

    handleFileSelection() {

        this.hideResult();


        super.handleFileSelection();
    }


    /* =====================================
       TRADUCIR DOCUMENTO
    ===================================== */

    async handleSubmit(event) {

        event.preventDefault();


        const file =
            this.input.files[0];


        if (!file) {

            StatusManager.show(
                this.statusId,
                "warning",
                "Selecciona un documento antes de continuar."
            );


            return;
        }


        const validation =
            this.validateFile(
                file
            );


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );


            return;
        }


        try {

            this.hideResult();


            this.setLoading(
                true
            );


            StatusManager.show(
                this.statusId,
                "loading",
                "Leyendo y traduciendo el documento..."
            );


            const formData =
                new FormData();


            formData.append(
                "document",
                file,
                file.name
            );


            const response =
                await fetch(
                    this.apiUrl,
                    {
                        method:
                            "POST",

                        body:
                            formData
                    }
                );


            const data =
                await AppUtils.readJson(
                    response
                );


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No fue posible procesar el documento."
                );
            }


            if (
                !data.original_text ||
                !data.translation
            ) {

                throw new Error(
                    "La respuesta del documento está incompleta."
                );
            }


            this.originalText.textContent =
                data.original_text;


            this.translatedText.textContent =
                data.translation;


            this.resultContainer
                .classList
                .remove(
                    "d-none"
                );


            StatusManager.show(
                this.statusId,
                "success",
                `Documento traducido correctamente: ${AppUtils.getLanguageName(data.source_language)} → ${AppUtils.getLanguageName(data.target_language)}.`
            );

        } catch (error) {

            console.error(
                "Error procesando documento:",
                error
            );


            this.hideResult();


            StatusManager.show(
                this.statusId,
                "error",
                error.message ||
                "No fue posible conectar con el servicio de documentos."
            );

        } finally {

            this.setLoading(
                false
            );
        }
    }


    /* =====================================
       OCULTAR RESULTADO DOCUMENTO
    ===================================== */

    hideResult() {

        if (this.resultContainer) {

            this.resultContainer
                .classList
                .add(
                    "d-none"
                );
        }


        if (this.originalText) {

            this.originalText.textContent =
                "";
        }


        if (this.translatedText) {

            this.translatedText.textContent =
                "";
        }
    }


    /* =====================================
       ESTADO BOTÓN DOCUMENTO
    ===================================== */

    setLoading(isLoading) {

        if (!this.submitButton) {

            return;
        }


        this.submitButton.disabled =
            isLoading;


        this.submitButton.textContent =
            isLoading
                ? "Procesando..."
                : "Traducir documento";
    }
}


/* =========================================
   MÓDULO DE IMÁGENES
========================================= */

class ImageModule extends FileModule {

    constructor(config) {

        super(config);


        this.apiUrl =
            config.apiUrl;


        this.submitButton =
            document.getElementById(
                config.submitButtonId
            );


        this.resultContainer =
            document.getElementById(
                config.resultContainerId
            );


        this.originalText =
            document.getElementById(
                config.originalTextId
            );


        this.translatedText =
            document.getElementById(
                config.translatedTextId
            );
    }


    /* =====================================
       IMAGEN SELECCIONADA
    ===================================== */

    handleFileSelection() {

        this.hideResult();


        super.handleFileSelection();
    }


    /* =====================================
       TRADUCIR IMAGEN
    ===================================== */

    async handleSubmit(event) {

        event.preventDefault();


        const file =
            this.input.files[0];


        if (!file) {

            StatusManager.show(
                this.statusId,
                "warning",
                "Selecciona una imagen antes de continuar."
            );


            return;
        }


        const validation =
            this.validateFile(
                file
            );


        if (!validation.valid) {

            StatusManager.show(
                this.statusId,
                "error",
                validation.message
            );


            return;
        }


        try {

            this.hideResult();


            this.setLoading(
                true
            );


            StatusManager.show(
                this.statusId,
                "loading",
                "Analizando y traduciendo la imagen..."
            );


            const imageData =
                await this.fileToDataURL(
                    file
                );


            const response =
                await fetch(
                    this.apiUrl,
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                image_data:
                                    imageData
                            })
                    }
                );


            const data =
                await AppUtils.readJson(
                    response
                );


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "No fue posible analizar la imagen."
                );
            }


            if (
                !data.detected_text ||
                !data.translation
            ) {

                throw new Error(
                    "La respuesta de la imagen está incompleta."
                );
            }


            this.originalText.textContent =
                data.detected_text;


            this.translatedText.textContent =
                data.translation;


            this.resultContainer
                .classList
                .remove(
                    "d-none"
                );


            StatusManager.show(
                this.statusId,
                "success",
                `Imagen traducida correctamente: ${AppUtils.getLanguageName(data.source_language)} → ${AppUtils.getLanguageName(data.target_language)}.`
            );

        } catch (error) {

            console.error(
                "Error al traducir imagen:",
                error
            );


            this.hideResult();


            StatusManager.show(
                this.statusId,
                "error",
                error.message ||
                "No fue posible conectar con el servicio de traducción de imágenes."
            );

        } finally {

            this.setLoading(
                false
            );
        }
    }


    /* =====================================
       CONVERTIR IMAGEN A DATA URL
    ===================================== */

    fileToDataURL(file) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const reader =
                    new FileReader();


                reader.onload =
                    () => {

                        resolve(
                            reader.result
                        );
                    };


                reader.onerror =
                    () => {

                        reject(
                            new Error(
                                "No fue posible leer la imagen seleccionada."
                            )
                        );
                    };


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    /* =====================================
       OCULTAR RESULTADO IMAGEN
    ===================================== */

    hideResult() {

        if (this.resultContainer) {

            this.resultContainer
                .classList
                .add(
                    "d-none"
                );
        }


        if (this.originalText) {

            this.originalText.textContent =
                "";
        }


        if (this.translatedText) {

            this.translatedText.textContent =
                "";
        }
    }


    /* =====================================
       ESTADO BOTÓN IMAGEN
    ===================================== */

    setLoading(isLoading) {

        if (!this.submitButton) {

            return;
        }


        this.submitButton.disabled =
            isLoading;


        this.submitButton.textContent =
            isLoading
                ? "Traduciendo..."
                : "Traducir imagen";
    }
}


/* =========================================
   APLICACIÓN PRINCIPAL
========================================= */

class TranslatorApp {

    constructor() {

        this.chat =
            null;


        this.audio =
            null;


        this.documents =
            null;


        this.images =
            null;
    }


    init() {

        /* =================================
           CHAT
        ================================= */

        this.chat =
            new ChatModule();


        /* =================================
           AUDIO
        ================================= */

        this.audio =
            new AudioModule({

                formId:
                    "audioForm",

                inputId:
                    "audioInput",

                fileNameId:
                    "audioFileName",

                statusId:
                    "audioStatus",

                allowedExtensions: [
                    "mp3",
                    "wav",
                    "m4a",
                    "webm"
                ],

                maxSizeMB:
                    4,

                submitButtonId:
                    "translateAudioButton",

                resultContainerId:
                    "audioResult",

                originalTextId:
                    "audioOriginalText",

                translatedTextId:
                    "audioTranslatedText",

                clearButtonId:
                    "clearAudioButton",

                copyOriginalButtonId:
                    "copyAudioOriginalButton",

                copyTranslatedButtonId:
                    "copyAudioTranslationButton",

                apiUrl:
                    AUDIO_API_URL
            });


        /* =================================
           DOCUMENTOS
        ================================= */

        this.documents =
            new DocumentModule({

                formId:
                    "documentForm",

                inputId:
                    "documentInput",

                fileNameId:
                    "documentFileName",

                statusId:
                    "documentStatus",

                allowedExtensions: [
                    "pdf",
                    "docx",
                    "txt"
                ],

                maxSizeMB:
                    4,

                submitButtonId:
                    "translateDocumentButton",

                resultContainerId:
                    "documentResult",

                originalTextId:
                    "documentOriginalText",

                translatedTextId:
                    "documentTranslatedText",

                clearButtonId:
                    "clearDocumentButton",

                copyOriginalButtonId:
                    "copyDocumentOriginalButton",

                copyTranslatedButtonId:
                    "copyDocumentTranslationButton",

                apiUrl:
                    DOCUMENT_API_URL
            });


        /* =================================
           IMÁGENES
        ================================= */

        this.images =
            new ImageModule({

                formId:
                    "imageForm",

                inputId:
                    "imageInput",

                fileNameId:
                    "imageFileName",

                statusId:
                    "imageStatus",

                allowedExtensions: [
                    "png",
                    "jpg",
                    "jpeg",
                    "webp"
                ],

                maxSizeMB:
                    3,

                previewContainerId:
                    "imagePreviewContainer",

                previewId:
                    "imagePreview",

                submitButtonId:
                    "translateImageButton",

                resultContainerId:
                    "imageResult",

                originalTextId:
                    "imageOriginalText",

                translatedTextId:
                    "imageTranslatedText",

                clearButtonId:
                    "clearImageButton",

                copyOriginalButtonId:
                    "copyImageOriginalButton",

                copyTranslatedButtonId:
                    "copyImageTranslationButton",

                apiUrl:
                    IMAGE_API_URL
            });
    }
}


/* =========================================
   INICIAR APLICACIÓN
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const app =
            new TranslatorApp();


        app.init();
    }
);