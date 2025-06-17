const usernameForm = document.getElementById('usernameForm');
const usernameInput = document.getElementById('username');
const usernameError = document.getElementById('usernameError');

usernameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    
    if (!username) {
        usernameError.textContent = 'Username is required';
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        usernameError.textContent = 'Username must be between 3 and 20 characters';
        return;
    }
    
    // Check if username is available
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    
    try {
        // Check if username exists
        const snapshot = await db.collection('users')
            .where('username', '==', username.toLowerCase())
            .get();
        
        if (!snapshot.empty) {
            usernameError.textContent = 'Username is already taken';
            return;
        }
        
        // Save user to Firestore
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            username: username.toLowerCase(),
            usernameDisplay: username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Redirect to chat
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error setting username:', error);
        usernameError.textContent = 'Error setting username: ' + error.message;
    }
});

// Check if user is logged in
auth.onAuthStateChanged(user => {
    if (!user) {
        window.location.href = 'auth.html';
    }
});
