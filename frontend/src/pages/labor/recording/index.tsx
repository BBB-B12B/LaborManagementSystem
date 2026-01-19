import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Grid,
    TextField,
    MenuItem,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import { Layout, ProtectedRoute } from '@/components/layout';
import { importedWageSystemService, ImportedWageSystem } from '@/services/api/importedWageSystem.service';

interface LaborRow {
    id: string;
    contractorName: string;
    position: string;
    total: number;
    thai: number;
    cambodia: number;
    lao: number;
    myanmar: number;
    illegal: number;
    remarks: string;
}

export default function LaborRecordingPage() {
    const [selectedProject, setSelectedProject] = useState('');
    const [projects, setProjects] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<LaborRow[]>([
        {
            id: '1',
            contractorName: 'บริษัท ที.ที.เอส. เอ็นจิเนียริ่ง (2004)',
            position: 'กรรมกร',
            total: 7,
            thai: 1,
            cambodia: 6,
            lao: 0,
            myanmar: 0,
            illegal: 0,
            remarks: '',
        },
        {
            id: '2',
            contractorName: 'บริษัท ที.ที.เอส. เอ็นจิเนียริ่ง (2004)',
            position: 'คนขับรถกระบะ',
            total: 3,
            thai: 3,
            cambodia: 0,
            lao: 0,
            myanmar: 0,
            illegal: 0,
            remarks: '',
        },
    ]);

    // Derived value for total labor count
    const currentLaborCount = rows.reduce((acc, row) => acc + (row.total || 0), 0);

    React.useEffect(() => {
        const fetchProjects = async () => {
            try {
                const data = await importedWageSystemService.getUniqueProjects();
                setProjects(data);
                if (data.length > 0) setSelectedProject(data[0]);
            } catch (err) {
                console.error('Failed to fetch projects:', err);
                setProjects(['คลังสินค้าและบริการ', 'โครงการ A']);
                setSelectedProject('คลังสินค้าและบริการ');
            }
        };
        fetchProjects();
    }, []);

    // Fetch rows when selectedProject changes
    React.useEffect(() => {
        if (!selectedProject) return;

        const fetchRows = async () => {
            setLoading(true);
            try {
                const projectData = await importedWageSystemService.getByProject(selectedProject);

                const tableRows: LaborRow[] = projectData.map((item: ImportedWageSystem) => {
                    const latestLog = item.logs && item.logs.length > 0
                        ? item.logs[item.logs.length - 1]
                        : null;

                    return {
                        id: item.id,
                        contractorName: item["ชื่อผู้รับเหมา"],
                        position: item["ตำแหน่งงาน"],
                        total: latestLog ? Number(latestLog["จำนวนรวม"] || 0) : 0,
                        thai: latestLog ? Number(latestLog["สัญชาติไทย"] || 0) : 0,
                        cambodia: latestLog ? Number(latestLog["สัญชาติกัมพูชา"] || 0) : 0,
                        lao: latestLog ? Number(latestLog["สัญชาติลาว"] || 0) : 0,
                        myanmar: latestLog ? Number(latestLog["สัญชาติเมียนมาร์"] || 0) : 0,
                        illegal: latestLog ? Number(latestLog["จำนวนแรงงานผิดกฎหมาย"] || 0) : 0,
                        remarks: latestLog ? latestLog["หมายเหตุ"] || '' : '',
                    };
                });

                setRows(tableRows.length > 0 ? tableRows : [
                    {
                        id: 'empty-1',
                        contractorName: '',
                        position: '',
                        total: 0,
                        thai: 0,
                        cambodia: 0,
                        lao: 0,
                        myanmar: 0,
                        illegal: 0,
                        remarks: '',
                    }
                ]);
            } catch (err) {
                console.error('Failed to fetch rows:', err);
                setRows([{
                    id: 'empty-1',
                    contractorName: '',
                    position: '',
                    total: 0,
                    thai: 0,
                    cambodia: 0,
                    lao: 0,
                    myanmar: 0,
                    illegal: 0,
                    remarks: '',
                }]);
            } finally {
                setLoading(false);
            }
        };

        fetchRows();
    }, [selectedProject]);

    const handleAddRow = () => {
        const newRow: LaborRow = {
            id: Date.now().toString(),
            contractorName: '',
            position: '',
            total: 0,
            thai: 0,
            cambodia: 0,
            lao: 0,
            myanmar: 0,
            illegal: 0,
            remarks: '',
        };
        setRows([...rows, newRow]);
    };

    const handleDeleteRow = (id: string) => {
        setRows(rows.filter((row) => row.id !== id));
    };

    const handleRowChange = (id: string, field: keyof LaborRow, value: any) => {
        setRows(
            rows.map((row) => {
                if (row.id === id) {
                    const updatedRow = { ...row, [field]: value };
                    // Auto-calculate total
                    if (['thai', 'cambodia', 'lao', 'myanmar', 'illegal'].includes(field as string)) {
                        updatedRow.total =
                            Number(updatedRow.thai) +
                            Number(updatedRow.cambodia) +
                            Number(updatedRow.lao) +
                            Number(updatedRow.myanmar) +
                            Number(updatedRow.illegal);
                    }
                    return updatedRow;
                }
                return row;
            })
        );
    };

    return (
        <ProtectedRoute requiredRoles={['AM', 'FM', 'SE', 'OE', 'PE', 'PM', 'PD', 'MD']}>
            <Layout>
                <Container maxWidth="xl" sx={{ py: 4 }}>
                    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                        ระบบบันทึกจำนวนแรงงาน
                    </Typography>

                    {/* Top Section: Project & Count */}
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    หน่วยงาน/โครงการ *
                                </Typography>
                                <TextField
                                    select
                                    fullWidth
                                    value={selectedProject}
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                    size="small"
                                >
                                    {projects.map((projectName) => (
                                        <MenuItem key={projectName} value={projectName}>
                                            {projectName}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    จำนวนแรงงานในปัจจุบัน
                                </Typography>
                                <TextField
                                    fullWidth
                                    value={currentLaborCount}
                                    InputProps={{
                                        readOnly: true,
                                    }}
                                    size="small"
                                    sx={{ bgcolor: '#f5f5f5' }}
                                />
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Table Section */}
                    <Paper sx={{ p: 0, mt: 3, overflow: 'hidden', borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>รายการแรงงาน</Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddRow}
                                sx={{ bgcolor: '#4A69BD', '&:hover': { bgcolor: '#3c55a5' } }}
                            >
                                เพิ่มแถว
                            </Button>
                        </Box>

                        <TableContainer>
                            <Table sx={{ minWidth: 650 }} aria-label="labor table">
                                <TableHead sx={{ bgcolor: '#C5A059' }}>
                                    <TableRow>
                                        <TableCell align="center" width="5%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>No.</TableCell>
                                        <TableCell width="20%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>ชื่อผู้รับเหมา *</TableCell>
                                        <TableCell width="15%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>ตำแหน่งงาน *</TableCell>
                                        <TableCell align="center" width="8%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>จำนวนรวม</TableCell>
                                        <TableCell align="center" width="8%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>สัญชาติไทย</TableCell>
                                        <TableCell align="center" width="8%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>สัญชาติกัมพูชา</TableCell>
                                        <TableCell align="center" width="8%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>สัญชาติลาว</TableCell>
                                        <TableCell align="center" width="8%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>สัญชาติเมียนมาร์</TableCell>
                                        <TableCell align="center" width="10%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>แรงงานผิดกฎหมาย</TableCell>
                                        <TableCell align="center" width="10%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>หมายเหตุ</TableCell>
                                        <TableCell align="center" width="5%" sx={{ color: 'white', fontWeight: 'bold', bgcolor: '#C5A059' }}>ลบแถว</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row, index) => (
                                        <TableRow key={row.id}>
                                            <TableCell align="center">{index + 1}</TableCell>
                                            <TableCell>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    value={row.contractorName}
                                                    onChange={(e) => handleRowChange(row.id, 'contractorName', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    value={row.position}
                                                    onChange={(e) => handleRowChange(row.id, 'position', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ border: '1px solid #ddd', p: 1, borderRadius: 1, bgcolor: '#f9f9f9' }}>
                                                    {row.total}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    value={row.thai}
                                                    onChange={(e) => handleRowChange(row.id, 'thai', Number(e.target.value))}
                                                    inputProps={{ min: 0, style: { textAlign: 'center' } }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    value={row.cambodia}
                                                    onChange={(e) => handleRowChange(row.id, 'cambodia', Number(e.target.value))}
                                                    inputProps={{ min: 0, style: { textAlign: 'center' } }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    value={row.lao}
                                                    onChange={(e) => handleRowChange(row.id, 'lao', Number(e.target.value))}
                                                    inputProps={{ min: 0, style: { textAlign: 'center' } }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    value={row.myanmar}
                                                    onChange={(e) => handleRowChange(row.id, 'myanmar', Number(e.target.value))}
                                                    inputProps={{ min: 0, style: { textAlign: 'center' } }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    type="number"
                                                    size="small"
                                                    value={row.illegal}
                                                    onChange={(e) => handleRowChange(row.id, 'illegal', Number(e.target.value))}
                                                    inputProps={{ min: 0, style: { textAlign: 'center' } }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    value={row.remarks}
                                                    onChange={(e) => handleRowChange(row.id, 'remarks', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <IconButton onClick={() => handleDeleteRow(row.id)} color="error">
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* Centered Submit Button */}
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                        <Button
                            variant="contained"
                            size="large"
                            sx={{
                                bgcolor: '#50C878',
                                px: 6,
                                '&:hover': { bgcolor: '#45b36b' },
                                borderRadius: 1,
                                textTransform: 'none',
                                fontWeight: 'bold'
                            }}
                        >
                            Submit
                        </Button>
                    </Box>
                </Container>
            </Layout>
        </ProtectedRoute >
    );
}
