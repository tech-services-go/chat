    // Firebase configuration - replace with your own
    const firebaseConfig = {
      apiKey: "AIzaSyA8Q3X1G4z4z4z4z4z4z4z4z4z4z4z4z4",
      authDomain: "realtime-chat-12345.firebaseapp.com",
      projectId: "realtime-chat-12345",
      storageBucket: "realtime-chat-12345.appspot.com",
      messagingSenderId: "123456789012",
      appId: "1:123456789012:web:abcdef1234567890"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // DOM elements
    const loginPage = document.getElementById('login-page');
    const chatApp = document.getElementById('chat-app');
    const googleLoginBtn = document.getElementById('google-login');
    const contactsList = document.getElementById('contacts-list');
    const chatMessages = document.getElementById('chat-messages');
    const chatHeader = document.getElementById('chat-header');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const searchContacts = document.getElementById('search-contacts');
    const sharedPhotosSection = document.getElementById('shared-photos-section');
    const sharedPhotos = document.getElementById('shared-photos');
    const sharedLinksSection = document.getElementById('shared-links-section');
    const sharedLinks = document.getElementById('shared-links');

    // Current user and chat state
    let currentUser = null;
    let currentChatId = null;
    let users = [];
    let chats = [];

    // Initialize the app
    function initApp() {
      auth.onAuthStateChanged(user => {
        if (user) {
          // User is signed in
          currentUser = user;
          loginPage.style.display = 'none';
          chatApp.style.display = 'flex';
          
          // Load user data
          loadUserData();
          
          // Set up realtime listeners
          setupRealtimeListeners();
        } else {
          // User is signed out
          currentUser = null;
          loginPage.style.display = 'flex';
          chatApp.style.display = 'none';
        }
      });
    }

    // Google login
    googleLoginBtn.addEventListener('click', () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      googleLoginBtn.disabled = true;
      googleLoginBtn.innerHTML = '<div class="spinner"></div>';
      
      auth.signInWithPopup(provider)
        .then(result => {
          // Check if user exists in Firestore
          const user = result.user;
          return db.collection('users').doc(user.uid).get();
        })
        .then(doc => {
          if (!doc.exists) {
            // Create new user in Firestore
            const user = auth.currentUser;
            return db.collection('users').doc(user.uid).set({
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL,
              username: user.email.split('@')[0], // Default username
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
              status: 'online'
            });
          }
        })
        .catch(error => {
          console.error('Login error:', error);
          googleLoginBtn.disabled = false;
          googleLoginBtn.innerHTML = 'Sign in with Google';
          alert('Login failed: ' + error.message);
        });
    });

    // Load user data
    function loadUserData() {
      // Load all users except current user
      db.collection('users')
        .where('uid', '!=', currentUser.uid)
        .get()
        .then(snapshot => {
          users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderContactsList(users);
        })
        .catch(error => {
          console.error('Error loading users:', error);
        });

      // Load user's chats
      db.collection('chats')
        .where('participants', 'array-contains', currentUser.uid)
        .get()
        .then(snapshot => {
          chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          renderChatList(chats);
        })
        .catch(error => {
          console.error('Error loading chats:', error);
        });
    }

    // Set up realtime listeners
    function setupRealtimeListeners() {
      // Update user status
      const userRef = db.collection('users').doc(currentUser.uid);
      
      // Set user as online
      userRef.update({
        status: 'online',
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Set user as offline when they disconnect
      firebase.firestore().enableNetwork().then(() => {
        window.addEventListener('beforeunload', () => {
          userRef.update({
            status: 'offline',
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
      });

      // Listen for user status changes
      db.collection('users')
        .where('uid', '!=', currentUser.uid)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'modified') {
              const user = { id: change.doc.id, ...change.doc.data() };
              const index = users.findIndex(u => u.id === user.id);
              if (index !== -1) {
                users[index] = user;
                updateContactStatus(user);
              }
            }
          });
        });

      // Listen for new messages in current chat
      if (currentChatId) {
        db.collection('chats').doc(currentChatId).collection('messages')
          .orderBy('timestamp', 'asc')
          .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
              if (change.type === 'added') {
                const message = change.doc.data();
                renderMessage(message, currentUser.uid);
              }
            });
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
          });
      }
    }

    // Render contacts list
    function renderContactsList(contacts) {
      contactsList.innerHTML = '';
      
      contacts.forEach(contact => {
        const lastMessage = contact.lastMessage || 'No messages yet';
        const unreadCount = contact.unreadCount || 0;
        const isOnline = contact.status === 'online';
        
        const contactElement = document.createElement('button');
        contactElement.className = 'flex items-center gap-2 rounded-md px-2 py-2 transition-colors duration-300 hover:bg-light';
        contactElement.innerHTML = `
          <div class="h-[42px] w-[42px] shrink-0 rounded-full ${isOnline ? 'border-2 border-green-500' : ''}">
            <img src="${contact.photoURL || 'https://picsum.photos/200'}" class="h-full w-full rounded-full object-cover" alt="${contact.displayName}" />
          </div>
          <div class="overflow-hidden text-left">
            <h2 class="truncate text-sm font-medium text-slate-200">${contact.displayName}</h2>
            <p class="truncate text-sm text-slate-400">${lastMessage}</p>
          </div>
          <div class="ml-auto flex flex-col items-end gap-1">
            <p class="text-xs text-slate-400">${formatTime(contact.lastMessageTime)}</p>
            ${unreadCount > 0 ? `<p class="grid h-4 w-4 place-content-center rounded-full bg-green-600 text-xs text-slate-200">${unreadCount}</p>` : ''}
          </div>
        `;
        
        contactElement.addEventListener('click', () => startChat(contact));
        contactsList.appendChild(contactElement);
      });
    }

    // Render chat list
    function renderChatList(chats) {
      // For simplicity, we'll just show contacts for now
      // In a real app, you'd show the actual chat history
    }

    // Start a chat with a user
    function startChat(contact) {
      currentChatId = findOrCreateChatId(contact.id);
      
      // Update chat header
      chatHeader.innerHTML = `
        <div class="h-[42px] w-[42px] shrink-0 rounded-full ${contact.status === 'online' ? 'border-2 border-green-500' : ''}">
          <img src="${contact.photoURL || 'https://picsum.photos/200'}" class="h-full w-full rounded-full object-cover" alt="${contact.displayName}" />
        </div>
        <div>
          <h2 class="text-base text-slate-200">${contact.displayName}</h2>
          <p class="text-xs text-slate-400">${contact.status === 'online' ? 'Online now' : 'Last seen ' + formatTime(contact.lastSeen)}</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 shrink-0 text-slate-400">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" class="ml-3 h-6 w-6 fill-slate-400" viewBox="0 0 24 24">
            <path d="M4.5 10.5C3.675 10.5 3 11.175 3 12C3 12.825 3.675 13.5 4.5 13.5C5.325 13.5 6 12.825 6 12C6 11.175 5.325 10.5 4.5 10.5ZM19.5 10.5C18.675 10.5 18 11.175 18 12C18 12.825 18.675 13.5 19.5 13.5C20.325 13.5 21 12.825 21 12C21 11.175 20.325 10.5 19.5 10.5ZM12 10.5C11.175 10.5 10.5 11.175 10.5 12C10.5 12.825 11.175 13.5 12 13.5C12.825 13.5 13.5 12.825 13.5 12C13.5 11.175 12.825 10.5 12 10.5Z"></path>
          </svg>
        </div>
      `;
      
      // Enable message input
      messageInput.disabled = false;
      sendButton.disabled = false;
      
      // Clear and load messages
      chatMessages.innerHTML = '';
      loadChatMessages(currentChatId);
      
      // Load shared content
      loadSharedContent(currentChatId);
    }

    // Find or create a chat ID between two users
    function findOrCreateChatId(otherUserId) {
      // Check if we already have a chat with this user
      const existingChat = chats.find(chat => 
        chat.participants.includes(currentUser.uid) && 
        chat.participants.includes(otherUserId)
      );
      
      if (existingChat) return existingChat.id;
      
      // Create a new chat
      const chatRef = db.collection('chats').doc();
      const chatId = chatRef.id;
      
      chatRef.set({
        id: chatId,
        participants: [currentUser.uid, otherUserId],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessage: '',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      return chatId;
    }

    // Load chat messages
    function loadChatMessages(chatId) {
      db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            const message = doc.data();
            renderMessage(message, currentUser.uid);
          });
          
          // Scroll to bottom
          chatMessages.scrollTop = chatMessages.scrollHeight;
        })
        .catch(error => {
          console.error('Error loading messages:', error);
        });
    }

    // Render a message
    function renderMessage(message, currentUserId) {
      const isCurrentUser = message.senderId === currentUserId;
      
      const messageElement = document.createElement('div');
      messageElement.className = `flex gap-3 px-3 py-5 ${isCurrentUser ? 'flex-row-reverse text-right' : ''}`;
      
      if (!isCurrentUser) {
        messageElement.innerHTML = `
          <div class="h-[45px] w-[45px] shrink-0 rounded-full">
            <img src="${message.senderPhotoURL || 'https://picsum.photos/200'}" class="h-full w-full rounded-full object-cover" alt="${message.senderName}" />
          </div>
          <div class="overflow-hidden text-left">
            <h2 class="truncate text-sm text-slate-200">${message.senderName} <span class="text-xs text-slate-400">${formatTime(message.timestamp)}</span></h2>
            <div class="mt-2 flex flex-col gap-2">
              <div class="rounded-md bg-indigo-600 px-2 py-1.5">
                <p class="truncate text-sm text-slate-100">${message.text}</p>
              </div>
            </div>
          </div>
        `;
      } else {
        messageElement.innerHTML = `
          <div class="h-[45px] w-[45px] shrink-0 rounded-full">
            <img src="${message.senderPhotoURL || 'https://picsum.photos/200'}" class="h-full w-full rounded-full object-cover" alt="${message.senderName}" />
          </div>
          <div class="overflow-hidden">
            <h2 class="truncate text-sm text-slate-200">${message.senderName} <span class="text-xs text-slate-400">${formatTime(message.timestamp)}</span></h2>
            <div class="mt-2 flex flex-col gap-2 justify-start">
              <div class="max-w-fit overflow-hidden rounded-md bg-light px-2 py-1.5">
                <p class="truncate text-sm text-slate-300">${message.text}</p>
              </div>
            </div>
          </div>
        `;
      }
      
      chatMessages.appendChild(messageElement);
    }

    // Send a message
    function sendMessage() {
      const text = messageInput.value.trim();
      if (!text || !currentChatId) return;
      
      const message = {
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      // Add message to chat
      db.collection('chats').doc(currentChatId).collection('messages').add(message)
        .then(() => {
          // Update last message in chat
          db.collection('chats').doc(currentChatId).update({
            lastMessage: text,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          // Clear input
          messageInput.value = '';
        })
        .catch(error => {
          console.error('Error sending message:', error);
          alert('Failed to send message: ' + error.message);
        });
    }

    // Load shared content (photos and links)
    function loadSharedContent(chatId) {
      // Reset shared content sections
      sharedPhotos.innerHTML = '';
      sharedLinks.innerHTML = '';
      sharedPhotosSection.classList.add('hidden');
      sharedLinksSection.classList.add('hidden');
      
      // Load shared photos
      db.collection('chats').doc(chatId).collection('messages')
        .where('type', '==', 'image')
        .orderBy('timestamp', 'desc')
        .limit(4)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            sharedPhotosSection.classList.remove('hidden');
            document.getElementById('photo-count').textContent = snapshot.size;
            
            snapshot.forEach(doc => {
              const message = doc.data();
              const img = document.createElement('img');
              img.src = message.content;
              img.alt = 'Shared photo';
              img.className = 'col-span-3 row-span-2 h-full w-full rounded-md object-cover';
              sharedPhotos.appendChild(img);
            });
          }
        });
      
      // Load shared links
      db.collection('chats').doc(chatId).collection('messages')
        .where('type', '==', 'link')
        .orderBy('timestamp', 'desc')
        .limit(3)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            sharedLinksSection.classList.remove('hidden');
            document.getElementById('link-count').textContent = snapshot.size;
            
            snapshot.forEach(doc => {
              const message = doc.data();
              const linkElement = document.createElement('div');
              linkElement.className = 'flex items-center gap-2';
              linkElement.innerHTML = `
                <div class="h-[45px] w-[45px] shrink-0 rounded-full">
                  <img src="${extractFavicon(message.content)}" class="h-full w-full rounded object-cover" alt="" />
                </div>
                <div class="overflow-hidden">
                  <h2 class="truncate text-slate-300">${message.text || 'Shared link'}</h2>
                  <p class="truncate text-xs text-slate-400">${message.content}</p>
                </div>
              `;
              sharedLinks.appendChild(linkElement);
            });
          }
        });
    }

    // Helper function to extract favicon from URL
    function extractFavicon(url) {
      try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}`;
      } catch {
        return 'https://picsum.photos/200';
      }
    }

    // Update contact status in UI
    function updateContactStatus(user) {
      const contactElements = contactsList.querySelectorAll('.flex.items-center.gap-2');
      
      contactElements.forEach(element => {
        const img = element.querySelector('img');
        if (img && img.alt === user.displayName) {
          const parentDiv = img.parentElement;
          if (user.status === 'online') {
            parentDiv.classList.add('border-2', 'border-green-500');
          } else {
            parentDiv.classList.remove('border-2', 'border-green-500');
          }
        }
      });
    }

    // Format timestamp
    function formatTime(timestamp) {
      if (!timestamp) return '';
      
      const date = timestamp.toDate();
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);
      
      if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffInHours < 48) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString();
      }
    }

    // Search contacts
    searchContacts.addEventListener('input', () => {
      const searchTerm = searchContacts.value.toLowerCase();
      
      if (searchTerm === '') {
        renderContactsList(users);
        return;
      }
      
      const filteredContacts = users.filter(user => 
        user.displayName.toLowerCase().includes(searchTerm) || 
        user.username.toLowerCase().includes(searchTerm)
      );
      
      renderContactsList(filteredContacts);
    });

    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    // Send message on button click
    sendButton.addEventListener('click', sendMessage);

    // Initialize the app
    initApp();
