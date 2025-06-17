document.getElementById('googleLogin').addEventListener('click', () => {
    auth.signInWithPopup(provider)
        .then((result) => {
            // Check if user has a username
            const user = result.user;
            db.collection('users').doc(user.uid).get()
                .then(doc => {
                    if (doc.exists && doc.data().username) {
                        // User has a username, redirect to chat
                        window.location.href = 'index.html';
                    } else {
                        // User needs to set a username
                        window.location.href = 'username.html';
                    }
                });
        })
        .catch((error) => {
            console.error('Error signing in:', error);
            alert('Error signing in: ' + error.message);
        });
});

// Check if user is already logged in
auth.onAuthStateChanged(user => {
    if (user) {
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists && doc.data().username) {
                    window.location.href = 'index.html';
                } else {
                    window.location.href = 'username.html';
                }
            });
    }
});
