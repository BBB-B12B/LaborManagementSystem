import { getAllProjects } from './projectService';

async function list() {
    try {
        const projects = await getAllProjects();
        process.stdout.write(JSON.stringify(projects.slice(0, 5).map((p: any) => ({ id: p.id, projectName: p.projectName })), null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

list();
