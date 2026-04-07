
console.log('Starting check-hash.js');
try {
    const bcrypt = require('bcrypt');
    console.log('Bcrypt loaded');

    const hash = '$2b$10$gwBwjtqF35yng130dYh.LOHSfSwiHldIPcny3tMT5XaipmgjFyr7C';
    const pass = 'admin123';

    bcrypt.compare(pass, hash).then(result => {
        console.log(`Password 'admin123' matches hash? ${result}`);
    }).catch(err => {
        console.error('Error in compare:', err);
    });
} catch (e) {
    console.error('Failed to load bcrypt:', e);
}
