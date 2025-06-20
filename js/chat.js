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

// Modify the addUserToSidebar function to use more aggressive status checking
// Modified addUserToSidebar function (remove the 500ms threshold - too aggressive)
function addUserToSidebar(user) {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset.userId = user.uid;

    // Set up a real-time listener for this user's status
    const userStatusRef = db.collection('users').doc(user.uid);
    const unsubscribe = userStatusRef.onSnapshot(doc => {
        const userData = doc.data();
        const statusIndicator = userItem.querySelector('.user-status');
        
        if (statusIndicator) {
            const lastActive = userData.lastActive?.toDate();
            const isOnline = userData.online || 
                           (lastActive && (new Date() - lastActive) < 30000); // 30 seconds threshold
            
            statusIndicator.className = `user-status ${isOnline ? 'online' : ''}`;
            statusIndicator.title = isOnline ? 'Online' : `Last seen ${formatLastActive(lastActive)}`;
        }
    });

    // Store unsubscribe function to clean up later
    userItem._unsubscribe = unsubscribe;

    userItem.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/40'}" alt="${user.usernameDisplay}">
        <div class="user-info">
            <h3>${user.usernameDisplay}</h3>
            <p>${user.email}</p>
        </div>
        <div class="user-status ${user.online ? 'online' : ''}"></div>
    `;
    
    userItem.addEventListener('click', () => selectUser(user));
    usersList.appendChild(userItem);
}

// Helper function to format last active time
function formatLastActive(timestamp) {
    if (!timestamp) return 'a long time ago';
    
    const now = new Date();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
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

function setupPresenceSystem(user) {
    const uid = user.uid;
    const userStatusRef = rtdb.ref(`/status/${uid}`);
    const userStatusFirestoreRef = db.collection('users').doc(uid);
    
    const isOfflineForFirestore = {
        online: false,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const isOnlineForFirestore = {
        online: true,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const isOfflineForRTDB = {
        state: 'offline',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    };
    
    const isOnlineForRTDB = {
        state: 'online',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    };
    
    rtdb.ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === false) {
            userStatusFirestoreRef.update(isOfflineForFirestore);
            return;
        }
        
        userStatusRef.onDisconnect()
            .set(isOfflineForRTDB)
            .then(() => {
                userStatusRef.set(isOnlineForRTDB);
                userStatusFirestoreRef.update(isOnlineForFirestore);
            });
    });
    
    // Monitor RTDB status changes for faster updates
    userStatusRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.state === 'offline') {
            userStatusFirestoreRef.update(isOfflineForFirestore);
        }
    });
}

function handleAuthStateChange(user) {
    if (user) {
        currentUser = user;
        const userRef = db.collection('users').doc(user.uid);

        // Set initial online status
        userRef.set({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            online: true,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Setup presence system
        setupPresenceSystem(user);

        // Update lastActive timestamp periodically while online
        const activityInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                userRef.update({
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }, 30000); // Update every 30 seconds

        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                userRef.update({
                    online: true,
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                userRef.update({
                    online: false,
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        // Clean up on logout
        const cleanup = () => {
            clearInterval(activityInterval);
            
            // Clean up all user listeners
            document.querySelectorAll('.user-item').forEach(item => {
                if (item._unsubscribe) {
                    item._unsubscribe();
                }
            });
            
            userRef.update({
                online: false,
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
        };

        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);

        // Load app data
        loadUserData();
        loadUsers();
        setupEventListeners();

    } else {
        // Handle logout case
        if (currentUser) {
            db.collection('users').doc(currentUser.uid).update({
                online: false,
                lastActive: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        currentUser = null;
    }
}

// Initialize the app
init();
