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

// Global variables
let currentUser = null;
let selectedUserId = null;
let users = [];
let chats = [];

// Initialize the app
function init() {
    auth.onAuthStateChanged(handleAuthStateChange);
}

// Load current user data
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

// Load all users except current user
function loadUsers() {
    db.collection('users')
        .where('uid', '!=', currentUser.uid)
        .onSnapshot(snapshot => {
            users = [];
            usersList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const user = doc.data();
                users.push(user);
                addUserToSidebar(user);
            });
            
            // Also load existing chats
            loadChats();
        });
}

// Search users
searchUsers.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const username = item.querySelector('.user-info h3').textContent.toLowerCase();
        if (username.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});

// Add user to sidebar
function addUserToSidebar(user) {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset.userId = user.uid;

    const lastActive = user.lastActive?.toDate();
    const isOnline = lastActive && (new Date() - lastActive) < 5 * 60 * 1000;

    userItem.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="${user.usernameDisplay}">
        <div class="user-info">
            <h3>${user.usernameDisplay}</h3>
            <p>${user.email}</p>
        </div>
        <div class="user-status ${isOnline ? 'online' : ''}"></div>
    `;
    
    userItem.addEventListener('click', () => selectUser(user));
    usersList.appendChild(userItem);
}

// Load existing chats
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
            
            // Highlight existing chats
            highlightExistingChats();
        });
}

// Highlight users with existing chats
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

// Select a user to chat with
function selectUser(user) {
    selectedUserId = user.uid;
    chatUserAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
    chatUserName.textContent = user.usernameDisplay;
    
    // Hide no-chat-selected and show active chat
    document.querySelector('.no-chat-selected').style.display = 'none';
    activeChat.style.display = 'flex';
    
    // Load messages for this chat
    loadMessages();
}

// Load messages for the selected chat
function loadMessages() {
    // Find existing chat or create a new one
    const existingChat = chats.find(chat => 
        chat.participants.includes(selectedUserId) && 
        chat.participants.includes(currentUser.uid)
    );
    
    const chatId = existingChat ? existingChat.id : 
        [currentUser.uid, selectedUserId].sort().join('_');
    
    // Clear existing messages
    messages.innerHTML = '';
    
    // Load messages
    db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            messages.innerHTML = '';
            
            snapshot.forEach(doc => {
                const message = doc.data();
                addMessageToChat(message);
            });
            
            // Scroll to bottom
            messages.scrollTop = messages.scrollHeight;
        });
}

// Add message to chat UI
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

// Send a new message
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !selectedUserId) return;
    
    // Find existing chat or create a new one
    const existingChat = chats.find(chat => 
        chat.participants.includes(selectedUserId) && 
        chat.participants.includes(currentUser.uid)
    );
    
    const chatId = existingChat ? existingChat.id : 
        [currentUser.uid, selectedUserId].sort().join('_');
    
    // If new chat, create it first
    if (!existingChat) {
        db.collection('chats').doc(chatId).set({
            participants: [currentUser.uid, selectedUserId],
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            // Then add the message
            addMessageToChatCollection(chatId, text);
        });
    } else {
        // Update last message in chat
        db.collection('chats').doc(chatId).update({
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Add the message
        addMessageToChatCollection(chatId, text);
    }
    
    // Clear input
    messageInput.value = '';
}

// Add message to Firestore
function addMessageToChatCollection(chatId, text) {
    db.collection('chats').doc(chatId).collection('messages').add({
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Setup event listeners
function setupEventListeners() {
    // Logout
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'auth.html';
        });
    });
    
    // Send message on button click
    sendMessageBtn.addEventListener('click', sendMessage);
    
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function handleAuthStateChange(user) {
    if (user) {
        currentUser = user;

        const userRef = db.collection('users').doc(user.uid);

        userRef.update({
            online: true,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.error('Error setting online:', err));

        document.addEventListener('visibilitychange', () => {
            userRef.update({
                online: document.visibilityState === 'visible',
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error('Visibility change error:', err));
        });

        window.addEventListener('beforeunload', () => {
            navigator.sendBeacon(`/update-status?uid=${user.uid}&online=false`);
        });

        window.addEventListener('unload', () => {
            userRef.update({
                online: false,
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => console.error('Unload update error:', err));
        });

        // Moved setup logic here
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

// Initialize the app
init();
