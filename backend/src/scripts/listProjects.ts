
import { collections } from '../config/collections';


async function listProjects() {
    try {
        console.log('Fetching projects...');
        const snapshot = await collections.projectLocations.get();
        if (snapshot.empty) {
            console.log('No projects found.');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`ID: ${doc.id}, Code: ${data.code}, Name: ${data.projectName}, Department: ${data.department}`);
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
    }
}

listProjects().then(() => process.exit(0));
