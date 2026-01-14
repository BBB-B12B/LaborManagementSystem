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
import { Layout, ProtectedRoute } from '@/components/layout';

// Mock Data for Projects (Replace with API call later)
const MOCK_PROJECTS = [
    { id: '1', name: 'คลังสินค้าและบริการ' },
    { id: '2', name: 'โครงการ A' },
];

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
    const [selectedProject, setSelectedProject] = useState('1');
    const [currentLaborCount, setCurrentLaborCount] = useState(80); // Mock initial value
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
                                    {MOCK_PROJECTS.map((project) => (
                                        <MenuItem key={project.id} value={project.id}>
                                            {project.name}
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
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">รายการแรงงาน</Typography>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddRow}
                                color="primary"
                            >
                                เพิ่มแถว
                            </Button>
                        </Box>

                        <TableContainer>
                            <Table sx={{ minWidth: 650 }} aria-label="labor table">
                                <TableHead sx={{ bgcolor: '#d2b48c' }}> {/* Approx color from image */}
                                    <TableRow>
                                        <TableCell align="center" width="5%">No.</TableCell>
                                        <TableCell width="20%">ชื่อผู้รับเหมา *</TableCell>
                                        <TableCell width="15%">ตำแหน่งงาน *</TableCell>
                                        <TableCell align="center" width="8%">จำนวนรวม</TableCell>
                                        <TableCell align="center" width="8%">สัญชาติ<br />ไทย</TableCell>
                                        <TableCell align="center" width="8%">สัญชาติ<br />กัมพูชา</TableCell>
                                        <TableCell align="center" width="8%">สัญชาติ<br />ลาว</TableCell>
                                        <TableCell align="center" width="8%">สัญชาติ<br />เมียนมาร์</TableCell>
                                        <TableCell align="center" width="10%">แรงงานผิดกฎหมาย</TableCell>
                                        <TableCell align="center" width="10%">หมายเหตุ</TableCell>
                                        <TableCell align="center" width="5%">ลบแถว</TableCell>
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
                </Container>
            </Layout>
        </ProtectedRoute>
    );
}
