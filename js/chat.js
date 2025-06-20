// DOM Elements
const userAvatar = document.getElementById('userAvatar');
const usernameDisplay = document.getElementById('usernameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const searchUsers = document.getElementById('searchUsers');
const usersList = document.getElementById('usersList');
const chatArea = document.getElementById('chatArea');
const activeChat = document.getElementById('activeChat');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const chatUserAvatar = document.getElementById('chatUserAvatar');
const chatUserName = document.getElementById('chatUserName');
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const googleAuth = document.getElementById('googleAuth');
const usernameSetup = document.getElementById('usernameSetup');

// Global variables
let currentUser = null;
let selectedUserId = null;
let users = [];
let chats = [];
let unsubscribeUsers = null;
let unsubscribeChat = null;

// Initialize the app
function init() {
    auth.onAuthStateChanged(handleAuthStateChange);
}

function handleAuthStateChange(user) {
    if (user) {
        currentUser = user;
        setPresence(user);
        loadUserData();
        loadUsers();
        setupEventListeners();
    } else {
        if (currentUser) {
            db.collection('users').doc(currentUser.uid).update({
                online: false,
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error('Sign-out update error:', err));
        }

        currentUser = null;

        authContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        googleAuth.style.display = 'block';
        usernameSetup.style.display = 'none';

        if (unsubscribeUsers) unsubscribeUsers();
        if (unsubscribeChat) unsubscribeChat();
        unsubscribeUsers = null;
        unsubscribeChat = null;
    }
}

function setPresence(user) {
    const userStatusDatabaseRef = firebase.database().ref(`/status/${user.uid}`);
    const userDocRef = db.collection('users').doc(user.uid);

    const isOfflineForDatabase = {
        state: 'offline',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    };

    const isOnlineForDatabase = {
        state: 'online',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    };

    const isOfflineForFirestore = {
        online: false,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    };

    const isOnlineForFirestore = {
        online: true,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    };

    firebase.database().ref('.info/connected').on('value', snapshot => {
        if (snapshot.val() === false) return;

        userStatusDatabaseRef.onDisconnect().update(isOfflineForDatabase).then(() => {
            userStatusDatabaseRef.update(isOnlineForDatabase);
            userDocRef.update(isOnlineForFirestore);
        });
    });
}

function loadUserData() {
    db.collection('users').doc(currentUser.uid).get()
        .then(doc => {
            if (doc.exists) {
                const userData = doc.data();
                userAvatar.src = userData.photoURL || 'https://via.placeholder.com/40';
                usernameDisplay.textContent = userData.usernameDisplay || userData.displayName || 'User';
            }
        });
}

function loadUsers() {
    if (unsubscribeUsers) unsubscribeUsers();

    unsubscribeUsers = db.collection('users')
        .where('uid', '!=', currentUser.uid)
        .onSnapshot(snapshot => {
            users = [];
            usersList.innerHTML = '';

            snapshot.forEach(doc => {
                const user = doc.data();
                users.push(user);
                addUserToSidebar(user);
            });

            loadChats();
        });
}

function addUserToSidebar(user) {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset.userId = user.uid;

    userItem.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="${user.usernameDisplay}">
        <div class="user-info">
            <h3>${user.usernameDisplay}</h3>
            <p>${user.email}</p>
        </div>
        <div class="user-status" id="status-${user.uid}"></div>
    `;

    const statusRef = firebase.database().ref(`/status/${user.uid}`);
    statusRef.on('value', snapshot => {
        const status = snapshot.val();
        const isOnline = status?.state === 'online';
        const statusDot = userItem.querySelector('.user-status');
        if (isOnline) {
            statusDot.classList.add('online');
        } else {
            statusDot.classList.remove('online');
        }
    });

    userItem.addEventListener('click', () => selectUser(user));
    usersList.appendChild(userItem);
}

function loadChats() {
    db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .onSnapshot(snapshot => {
            chats = [];
            snapshot.forEach(doc => {
                const chat = {
                    id: doc.id,
                    ...doc.data()
                };
                chats.push(chat);
            });

            highlightExistingChats();
        });
}

function highlightExistingChats() {
    const userItems = document.querySelectorAll('.user-item');
    userItems.forEach(item => {
        const userId = item.dataset.userId;
        const hasChat = chats.some(chat =>
            chat.participants.includes(userId) &&
            chat.participants.includes(currentUser.uid)
        );
        if (hasChat) {
            item.classList.add('has-chat');
        } else {
            item.classList.remove('has-chat');
        }
    });
}

function selectUser(user) {
    selectedUserId = user.uid;
    chatUserAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
    chatUserName.textContent = user.usernameDisplay;
    document.querySelector('.no-chat-selected').style.display = 'none';
    activeChat.style.display = 'flex';
    loadMessages();
}

function loadMessages() {
    if (unsubscribeChat) unsubscribeChat();

    const existingChat = chats.find(chat =>
        chat.participants.includes(selectedUserId) &&
        chat.participants.includes(currentUser.uid)
    );

    const chatId = existingChat ? existingChat.id :
        [currentUser.uid, selectedUserId].sort().join('_');

    messages.innerHTML = '';

    unsubscribeChat = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            messages.innerHTML = '';
            snapshot.forEach(doc => addMessageToChat(doc.data()));
            messages.scrollTop = messages.scrollHeight;
        });
}

function addMessageToChat(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
    const time = message.timestamp ? message.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
    messageDiv.innerHTML = `
        <div class="message-content">${message.text}</div>
        <div class="message-time">${time}</div>
    `;
    messages.appendChild(messageDiv);
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !selectedUserId) return;

    const existingChat = chats.find(chat =>
        chat.participants.includes(selectedUserId) &&
        chat.participants.includes(currentUser.uid)
    );

    const chatId = existingChat ? existingChat.id :
        [currentUser.uid, selectedUserId].sort().join('_');

    const chatRef = db.collection('chats').doc(chatId);

    if (!existingChat) {
        chatRef.set({
            participants: [currentUser.uid, selectedUserId],
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => addMessageToChatCollection(chatId, text));
    } else {
        chatRef.update({
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        addMessageToChatCollection(chatId, text);
    }

    messageInput.value = '';
}

function addMessageToChatCollection(chatId, text) {
    db.collection('chats').doc(chatId).collection('messages').add({
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function setupEventListeners() {
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'auth.html';
        });
    });

    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });
}

init();
