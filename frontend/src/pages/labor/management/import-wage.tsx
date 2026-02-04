
import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Container,
    LinearProgress,
    Typography,
    Alert,
    Stack,
    Divider
} from '@mui/material';
import { db } from '@/config/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import importData from '@/data/wage_import_data.json';
import Navbar from '@/components/layout/Navbar';

const ImportWagePage = () => {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleImport = async () => {
        setLoading(true);
        setError(null);
        setStatus('Starting Import...');
        setProgress(0);

        try {
            const { projects, summaryLog, planning } = importData;
            const totalItems = 1 + summaryLog.length + planning.length; // 1 for projects data
            let processed = 0;

            // 1. Import Projects (Single Doc)
            setStatus('Importing Metadata Projects...');
            const batch0 = writeBatch(db);
            const projectRef = doc(db, 'wageCalculationSystem', 'metadata_projects');
            batch0.set(projectRef, {
                projects: projects,
                updatedAt: serverTimestamp(),
                importedBy: 'FrontendImporter'
            });
            await batch0.commit();
            processed++;
            setProgress((processed / totalItems) * 100);

            // 2. Import Summary (Batched)
            setStatus('Importing Summary Data Logs...');
            const SUMMARY_BATCH_SIZE = 400;
            for (let i = 0; i < summaryLog.length; i += SUMMARY_BATCH_SIZE) {
                const chunk = summaryLog.slice(i, i + SUMMARY_BATCH_SIZE);
                const batch = writeBatch(db);

                chunk.forEach((row: any) => {
                    const ref = doc(collection(db, 'wageCalculationSystem'));
                    batch.set(ref, {
                        ...row,
                        // Ensure numbers are numbers
                        จำนวน: parseInt(row['จำนวน'] || '0', 10),
                        จำนวนแรงงานผิดกฎหมาย: parseInt(row['จำนวนแรงงานผิดกฎหมาย'] || '0', 10),
                        source: 'Summary Data log',
                        importedAt: serverTimestamp()
                    });
                });

                await batch.commit();
                processed += chunk.length;
                setProgress((processed / totalItems) * 100);
            }

            // 3. Import Planning (Batched)
            setStatus('Importing Planning Data...');
            const PLAN_BATCH_SIZE = 400;
            for (let i = 0; i < planning.length; i += PLAN_BATCH_SIZE) {
                const chunk = planning.slice(i, i + PLAN_BATCH_SIZE);
                const batch = writeBatch(db);

                chunk.forEach((row: any) => {
                    const ref = doc(collection(db, 'wageCalculationPlanning'));
                    batch.set(ref, {
                        ...row,
                        จำนวน: parseInt(row['จำนวน'] || '0', 10),
                        importedAt: serverTimestamp()
                    });
                });

                await batch.commit();
                processed += chunk.length;
                setProgress((processed / totalItems) * 100);
            }

            setStatus('Import Completed Successfully! ✅');
            setProgress(100);

        } catch (err: any) {
            console.error('Import Error:', err);
            setError(err.message || 'Unknown error occurred');
            setStatus('Import Failed ❌');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <Navbar />
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Card>
                    <CardContent>
                        <Typography variant="h5" gutterBottom>
                            Wage Data Import Tool
                        </Typography>
                        <Typography color="textSecondary" paragraph>
                            This tool imports data from the bundled CSV/JSON files into Firestore.
                        </Typography>

                        <Box sx={{ my: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold">Data Stats:</Typography>
                            <Stack spacing={1} sx={{ mt: 1 }}>
                                <Typography>• Projects: {importData.projects.length} records</Typography>
                                <Typography>• Summary Logs: {importData.summaryLog.length} records</Typography>
                                <Typography>• Planning: {importData.planning.length} records</Typography>
                            </Stack>
                        </Box>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {status && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" gutterBottom>
                                    {status}
                                </Typography>
                                <LinearProgress variant="determinate" value={progress} />
                            </Box>
                        )}

                        <Divider sx={{ my: 2 }} />

                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={handleImport}
                            disabled={loading || progress === 100}
                        >
                            {loading ? 'Importing...' : 'Start Import'}
                        </Button>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
};

export default ImportWagePage;
