// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCgYX1nwmQeOisH7q9ab2AAgRY92AV_JBs",
    authDomain: "ag-vallkey.firebaseapp.com",
    projectId: "ag-vallkey",
    storageBucket: "ag-vallkey.firebasestorage.app",
    messagingSenderId: "130855818425",
    appId: "1:130855818425:web:f3b79bf42852bde07bf768",
    measurementId: "G-9K8EQ92HC1"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {

    let players = [];

    // Navigation Logic
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');

            // Remove active from all
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));

            // Add active to clicked
            item.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Real-time listener for players collection
    db.collection("players").onSnapshot((snapshot) => {
        players = [];
        snapshot.forEach((doc) => {
            players.push({ _id: doc.id, ...doc.data() });
        });
        renderTable();
        updateDashboard();
    }, (error) => {
        console.error("Firestore Listen failed: ", error);
        showToast("Error connecting to database", "var(--red)");
    });

    // Create User Logic
    const createForm = document.getElementById('createUserForm');
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const initialPoints = parseInt(document.getElementById('initialPoints').value) || 0;

        // Validate existence in Firebase
        try {
            const querySnapshot = await db.collection("players").where("username", "==", username).get();
            if (!querySnapshot.empty) {
                showToast('Username already exists!', 'var(--red)');
                return;
            }

            const newPlayer = {
                id: 'AG' + Math.floor(10000 + Math.random() * 90000),
                username,
                password,
                points: initialPoints,
                createdAt: new Date().toLocaleDateString()
            };

            await db.collection("players").add(newPlayer);
            showToast(`Player ${username} created successfully!`);
            createForm.reset();
        } catch (error) {
            console.error(error);
            showToast('Error creating user', 'var(--red)');
        }
    });

    // Render Manage Users Table
    const tbody = document.getElementById('userTableBody');
    function renderTable() {
        tbody.innerHTML = '';
        players.forEach(player => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td><strong>${player.username}</strong><br><small style="color:var(--text-muted)">${player.id}</small></td>
                <td><span style="font-family: monospace; letter-spacing: 2px;">••••••••</span></td>
                <td><strong style="color:var(--green)">${parseFloat(player.points).toFixed(2)}</strong> pts</td>
                <td>${player.createdAt}</td>
                <td>
                    <button class="action-btn" onclick="openTransferModal('${player.username}')">
                        <i class="ph ph-arrows-left-right"></i> Transfer Points
                    </button>
                    ${player.username === 'admin' ? '' : `<button class="action-btn" style="color:var(--red); border-color:rgba(239, 68, 68, 0.3)" onclick="deleteUser('${player.username}')">
                        <i class="ph ph-trash"></i>
                    </button>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Re-apply search filter after rendering
        const searchInput = document.querySelector('.search-bar input');
        if (searchInput && searchInput.value) {
            searchInput.dispatchEvent(new Event('input'));
        }
    }

    // Search Logic
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.querySelector('td:first-child').innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }

    // Dashboard Stats Logic
    function updateDashboard() {
        document.getElementById('totalPlayersCount').innerText = players.length;
        const totalPoints = players.reduce((sum, player) => sum + parseFloat(player.points || 0), 0);
        document.getElementById('totalPointsCount').innerText = totalPoints.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Modal Logic for Points Transfer
    const modal = document.getElementById('pointsModal');
    const closeBtn = document.querySelector('.close-modal');

    window.openTransferModal = (username) => {
        document.getElementById('targetUsername').value = username;
        document.getElementById('modalTitle').innerText = `Manage Points: ${username}`;
        document.getElementById('transferAmount').value = '';
        modal.classList.add('open');
    };

    closeBtn.addEventListener('click', () => modal.classList.remove('open'));

    // Handle Deposit
    document.getElementById('btnDeposit').addEventListener('click', () => {
        handleTransfer('deposit');
    });

    // Handle Withdraw
    document.getElementById('btnWithdraw').addEventListener('click', () => {
        handleTransfer('withdraw');
    });

    function handleTransfer(type) {
        const username = document.getElementById('targetUsername').value;
        const amount = parseFloat(document.getElementById('transferAmount').value);

        if (!amount || amount <= 0) {
            showToast('Enter a valid amount!', 'var(--red)');
            return;
        }

        const player = players.find(p => p.username === username);
        if (player) {
            let newPoints = parseFloat(player.points || 0);

            if (type === 'deposit') {
                newPoints += amount;
            } else if (type === 'withdraw') {
                if (newPoints >= amount) {
                    newPoints -= amount;
                } else {
                    showToast('Insufficient points to withdraw!', 'var(--red)');
                    return;
                }
            }

            // Update in Firestore
            db.collection("players").doc(player._id).update({ points: newPoints })
                .then(() => {
                    showToast(`Successfully processed point transfer!`);
                    modal.classList.remove('open');
                })
                .catch(err => {
                    console.error(err);
                    showToast('Error updating points in database', 'var(--red)');
                });
        }
    }

    // Delete User
    window.deleteUser = (username) => {
        const player = players.find(p => p.username === username);
        if (player && confirm(`Are you sure you want to delete ${username}?`)) {
            db.collection("players").doc(player._id).delete()
                .then(() => {
                    showToast(`Player ${username} removed!`);
                })
                .catch(err => {
                    console.error(err);
                    showToast('Error deleting user', 'var(--red)');
                });
        }
    }

    // Toast Notification
    const toast = document.getElementById('toast');
    function showToast(message, bgColor = 'var(--green)') {
        toast.innerText = message;
        toast.style.background = bgColor;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
});
