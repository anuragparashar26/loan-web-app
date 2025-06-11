// script.js
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.querySelector('#send-btn');
    const userInput = document.querySelector('#user-input');
    const voiceBtn = document.querySelector('#voice-btn');
    const languageSelect = document.querySelector('#language');
    const messageContainer = document.querySelector('.message-container');
    const chatbotBody = document.querySelector('.chatbot-body');

    // Speech Recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = SpeechRecognition ? new SpeechRecognition() : null;
    let isRecording = false;

    if (recognition) {
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = async (event) => {
            const detectedSpeech = event.results[0][0].transcript;
            let translatedText = await translateToEnglish(detectedSpeech, recognition.lang);
            userInput.value = translatedText;
            sendMessage();
        };

        recognition.onend = () => {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.querySelector('i').classList.remove('fa-microphone-slash');
            voiceBtn.querySelector('i').classList.add('fa-microphone');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceBtn.querySelector('i').classList.remove('fa-microphone-slash');
            voiceBtn.querySelector('i').classList.add('fa-microphone');
            addBotMessage('Oops, I couldn’t hear you! Try again?');
        };
    }

    function scrollToBottom() {
        chatbotBody.scrollTop = chatbotBody.scrollHeight;
    }

    scrollToBottom();

    async function sendMessage() {
        const messageText = userInput.value.trim();
        if (messageText === '') return;

        const userMessage = document.createElement('div');
        userMessage.classList.add('message', 'user-message');
        userMessage.innerHTML = `
            <span class="icon user-icon"><i class="fa-solid fa-user" style="color: #ffffff;"></i></span>
            <p>${messageText}</p>
        `;
        messageContainer.appendChild(userMessage);
        scrollToBottom();

        try {
            const response = await fetch('http://localhost:3000/api/loan-advice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: messageText }),
            });

            const data = await response.json();
            let botResponse = data.response || 'Sorry, something went wrong.';
            
            const targetLang = languageSelect.value.split('-')[0];
            if (targetLang !== 'en') {
                botResponse = await translateToLanguage(botResponse, targetLang);
            }
            const displayResponse = botResponse.replace(/\n/g, '<br>');

            // Add bot response
            const botMessage = document.createElement('div');
            botMessage.classList.add('message', 'bot-message');
            botMessage.innerHTML = `
                <span class="icon bot-icon"><i class="fa-solid fa-robot" style="color: #ffffff;"></i></span>
                <p>${displayResponse}</p>
            `;
            messageContainer.appendChild(botMessage);
            scrollToBottom();
        } catch (error) {
            console.error('Error fetching loan advice:', error);
            addBotMessage('Error connecting to the server. Please try again.');
        }

        userInput.value = '';
    }

    function addBotMessage(text) {
        const botMessage = document.createElement('div');
        botMessage.classList.add('message', 'bot-message');
        botMessage.innerHTML = `
            <span class="icon bot-icon"><i class="fa-solid fa-robot" style="color: #ffffff;"></i></span>
            <p>${text}</p>
        `;
        messageContainer.appendChild(botMessage);
        scrollToBottom();
    }

    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    voiceBtn.addEventListener('click', () => {
        if (!recognition) {
            addBotMessage('Voice input isn’t available here!');
            return;
        }

        if (isRecording) {
            recognition.stop();
        } else {
            isRecording = true;
            voiceBtn.classList.add('recording');
            voiceBtn.querySelector('i').classList.remove('fa-microphone');
            voiceBtn.querySelector('i').classList.add('fa-microphone-slash');
            recognition.lang = languageSelect.value;
            recognition.start();
        }
    });

    async function translateToEnglish(text, sourceLang) {
        if (sourceLang === 'en-IN') return text;

        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang.split('-')[0]}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data[0][0][0];
        } catch (error) {
            console.error('Translation error:', error);
            return 'Translation failed.';
        }
    }

    async function translateToLanguage(text, targetLang) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data[0][0][0];
        } catch (error) {
            console.error('Translation error:', error);
            return 'Translation failed.';
        }
    }
});