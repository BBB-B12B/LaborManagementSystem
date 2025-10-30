# Responsive Design Guide
## คู่มือการออกแบบหน้าจอที่รองรับทุกอุปกรณ์

This guide ensures all components work seamlessly across mobile, tablet, and desktop devices.

## Table of Contents
- [Breakpoints](#breakpoints)
- [Responsive Patterns](#responsive-patterns)
- [Mobile-First Approach](#mobile-first-approach)
- [Testing Checklist](#testing-checklist)
- [Common Components](#common-components)
- [Best Practices](#best-practices)

---

## Breakpoints

Material-UI provides default breakpoints that we use throughout the application:

```typescript
// Material-UI Default Breakpoints
const breakpoints = {
  xs: 0,      // Extra small (mobile)      0px - 599px
  sm: 600,    // Small (mobile landscape)  600px - 899px
  md: 900,    // Medium (tablet)           900px - 1199px
  lg: 1200,   // Large (desktop)           1200px - 1535px
  xl: 1536,   // Extra large (wide)        1536px+
};
```

### Device Categories

| Device | Breakpoint | Width Range | Orientation |
|--------|-----------|-------------|-------------|
| **Mobile Phone** | `xs` | 320px - 599px | Portrait |
| **Mobile Phone** | `sm` | 600px - 899px | Landscape |
| **Tablet** | `md` | 900px - 1199px | Portrait/Landscape |
| **Desktop** | `lg` | 1200px - 1535px | Landscape |
| **Wide Desktop** | `xl` | 1536px+ | Landscape |

---

## Responsive Patterns

### 1. Using MUI Breakpoints in `sx` Prop

The most common pattern for responsive styling:

```typescript
import { Box } from '@mui/material';

<Box
  sx={{
    // Mobile first: applies to all screen sizes
    padding: 2,

    // Tablet and up: overrides for md breakpoint and larger
    md: {
      padding: 4,
    },

    // Desktop and up: overrides for lg breakpoint and larger
    lg: {
      padding: 6,
    },
  }}
>
  Content
</Box>
```

### 2. Responsive Grid Layout

Use Material-UI Grid for flexible layouts:

```typescript
import { Grid } from '@mui/material';

<Grid container spacing={2}>
  {/* Full width on mobile, half on tablet, third on desktop */}
  <Grid item xs={12} md={6} lg={4}>
    <Card>Content 1</Card>
  </Grid>

  <Grid item xs={12} md={6} lg={4}>
    <Card>Content 2</Card>
  </Grid>

  <Grid item xs={12} md={6} lg={4}>
    <Card>Content 3</Card>
  </Grid>
</Grid>
```

### 3. Responsive Typography

```typescript
import { Typography } from '@mui/material';

<Typography
  variant="h4"
  sx={{
    fontSize: {
      xs: '1.5rem',   // 24px on mobile
      md: '2rem',     // 32px on tablet
      lg: '2.5rem',   // 40px on desktop
    },
  }}
>
  Responsive Heading
</Typography>
```

### 4. Conditional Rendering by Screen Size

```typescript
import { useMediaQuery, useTheme } from '@mui/material';

export const ResponsiveComponent = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  return (
    <>
      {isMobile && <MobileView />}
      {isDesktop && <DesktopView />}
    </>
  );
};
```

### 5. Responsive Drawer/Navigation

```typescript
import { Drawer, useMediaQuery } from '@mui/material';

export const ResponsiveDrawer = () => {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? mobileOpen : true}
      onClose={handleDrawerToggle}
      sx={{
        width: { xs: 240, md: 280 },
      }}
    >
      {/* Drawer content */}
    </Drawer>
  );
};
```

---

## Mobile-First Approach

Always design for mobile first, then enhance for larger screens:

### ✅ Good: Mobile-First

```typescript
<Box
  sx={{
    // Mobile (default)
    display: 'flex',
    flexDirection: 'column',
    padding: 2,
    gap: 1,

    // Tablet and up
    md: {
      flexDirection: 'row',
      padding: 3,
      gap: 2,
    },

    // Desktop
    lg: {
      padding: 4,
      gap: 3,
    },
  }}
>
  {/* Content */}
</Box>
```

### ❌ Bad: Desktop-First

```typescript
<Box
  sx={{
    // Desktop (will break on mobile)
    display: 'flex',
    flexDirection: 'row',
    padding: 4,

    // Mobile (harder to override)
    xs: {
      flexDirection: 'column',
      padding: 2,
    },
  }}
>
  {/* Content */}
</Box>
```

---

## Testing Checklist

Use this checklist when implementing responsive designs:

### Mobile (320px - 599px)
- [ ] All text is readable (minimum 14px font size)
- [ ] Buttons are touchable (minimum 44x44px)
- [ ] Forms are easy to fill (large inputs, proper spacing)
- [ ] Navigation works (hamburger menu, bottom tabs)
- [ ] Tables are scrollable or transformed to cards
- [ ] No horizontal scrolling
- [ ] Images scale properly
- [ ] Modal dialogs fit screen
- [ ] Spacing is comfortable (not cramped)

### Tablet (600px - 1199px)
- [ ] Layout uses available space efficiently
- [ ] Grid switches to 2-3 columns where appropriate
- [ ] Navigation shows more items
- [ ] Forms show 2 columns where appropriate
- [ ] DataGrid shows more columns
- [ ] Sidebar can be permanent or collapsible

### Desktop (1200px+)
- [ ] Full layout with sidebar
- [ ] Multi-column grids (3-4 columns)
- [ ] All DataGrid columns visible
- [ ] Forms use full width with proper max-width
- [ ] Hover states work properly
- [ ] Keyboard navigation works

### Cross-Device
- [ ] Test portrait and landscape orientations
- [ ] Test on actual devices (not just browser DevTools)
- [ ] Images and icons are crisp on retina displays
- [ ] Touch targets work on touch devices
- [ ] Mouse interactions work on desktop
- [ ] No layout shifts when loading data

---

## Common Components

### Navbar (Responsive)

```typescript
import { AppBar, Toolbar, IconButton, Drawer } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

export const Navbar = () => {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <AppBar position="fixed">
        <Toolbar>
          {/* Mobile: Hamburger menu */}
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Labor Management
          </Typography>

          {/* Desktop: Show menu items */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button color="inherit">Dashboard</Button>
              <Button color="inherit">Reports</Button>
              <Button color="inherit">Settings</Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile: Drawer */}
      {isMobile && (
        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        >
          {/* Drawer content */}
        </Drawer>
      )}
    </>
  );
};
```

### DataGrid (Responsive)

```typescript
import { DataGrid } from '@/components/common';

export const ResponsiveDataGrid = () => {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));

  // Mobile: Show fewer columns
  const columns = isMobile
    ? [
        { field: 'id', headerName: 'ID', width: 80 },
        { field: 'name', headerName: 'ชื่อ', flex: 1 },
      ]
    : [
        { field: 'id', headerName: 'ID', width: 80 },
        { field: 'name', headerName: 'ชื่อ', flex: 1 },
        { field: 'department', headerName: 'สังกัด', width: 120 },
        { field: 'role', headerName: 'บทบาท', width: 120 },
        { field: 'status', headerName: 'สถานะ', width: 100 },
        { field: 'actions', headerName: 'การดำเนินการ', width: 150 },
      ];

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      density={isMobile ? 'compact' : 'standard'}
      pageSize={isMobile ? 5 : 10}
      autoHeight={isMobile}
    />
  );
};
```

### Form (Responsive)

```typescript
import { Grid, TextField, Button } from '@mui/material';

export const ResponsiveForm = () => {
  return (
    <Box
      component="form"
      sx={{
        maxWidth: { xs: '100%', md: 800 },
        mx: 'auto',
        p: { xs: 2, md: 4 },
      }}
    >
      <Grid container spacing={2}>
        {/* Full width on mobile, half on desktop */}
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="ชื่อ" />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField fullWidth label="นามสกุล" />
        </Grid>

        {/* Full width */}
        <Grid item xs={12}>
          <TextField fullWidth label="อีเมล" />
        </Grid>

        {/* Buttons: Stack on mobile, row on desktop */}
        <Grid item xs={12}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="outlined" fullWidth={{ xs: true, sm: false }}>
              ยกเลิก
            </Button>
            <Button variant="contained" fullWidth={{ xs: true, sm: false }}>
              บันทึก
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
```

### Dashboard Cards (Responsive)

```typescript
import { Grid, Card, CardContent } from '@mui/material';

export const DashboardStats = () => {
  return (
    <Grid container spacing={2}>
      {stats.map((stat) => (
        <Grid
          item
          xs={12}    // Full width on mobile
          sm={6}     // Half width on mobile landscape
          md={4}     // Third width on tablet
          lg={3}     // Quarter width on desktop
          key={stat.id}
        >
          <Card>
            <CardContent>
              <Typography variant="h6">{stat.label}</Typography>
              <Typography variant="h4">{stat.value}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
```

### Modal/Dialog (Responsive)

```typescript
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

export const ResponsiveDialog = ({ open, onClose }) => {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}  // Full screen on mobile
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Title</DialogTitle>
      <DialogContent>Content</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
};
```

---

## Best Practices

### 1. Touch Targets

Ensure all interactive elements are large enough for touch:

```typescript
// ✅ Good: Large touch target (44x44px minimum)
<IconButton sx={{ p: 1.5 }}>
  <DeleteIcon />
</IconButton>

// ❌ Bad: Too small for touch
<IconButton sx={{ p: 0.5 }}>
  <DeleteIcon />
</IconButton>
```

### 2. Readable Text

Ensure text is readable on all devices:

```typescript
// ✅ Good: Minimum 14px on mobile
<Typography
  variant="body2"
  sx={{
    fontSize: { xs: '0.875rem', md: '1rem' },
  }}
>
  Text content
</Typography>

// ❌ Bad: Too small on mobile
<Typography sx={{ fontSize: '0.75rem' }}>
  Tiny text
</Typography>
```

### 3. Scrollable Tables

Make tables scrollable on mobile:

```typescript
// ✅ Good: Horizontal scroll on mobile
<Box sx={{ overflowX: 'auto' }}>
  <DataGrid rows={rows} columns={columns} />
</Box>

// Or transform to cards on mobile
{isMobile ? (
  <Box>
    {rows.map((row) => (
      <Card key={row.id}>
        <CardContent>{/* Row data */}</CardContent>
      </Card>
    ))}
  </Box>
) : (
  <DataGrid rows={rows} columns={columns} />
)}
```

### 4. Spacing

Use responsive spacing:

```typescript
// ✅ Good: Less padding on mobile
<Box sx={{ p: { xs: 2, md: 4, lg: 6 } }}>
  Content
</Box>

// ❌ Bad: Same padding everywhere
<Box sx={{ p: 6 }}>
  Content (too much padding on mobile)
</Box>
```

### 5. Container Max Width

Limit content width on large screens:

```typescript
// ✅ Good: Readable line length
<Container maxWidth="lg">
  <Typography>Long text content...</Typography>
</Container>

// ❌ Bad: Text too wide on large screens
<Box>
  <Typography>Very long lines of text are hard to read...</Typography>
</Box>
```

### 6. Images

Make images responsive:

```typescript
// ✅ Good: Responsive image
<Box
  component="img"
  src="/image.jpg"
  alt="Description"
  sx={{
    width: '100%',
    height: 'auto',
    maxWidth: { xs: '100%', md: 600 },
  }}
/>

// ❌ Bad: Fixed size image
<img src="/image.jpg" width="600" height="400" />
```

### 7. Navigation

Use appropriate navigation for each device:

```typescript
// ✅ Good: Drawer on mobile, permanent sidebar on desktop
{isMobile ? (
  <Drawer variant="temporary" open={open} onClose={handleClose}>
    {menuItems}
  </Drawer>
) : (
  <Drawer variant="permanent">
    {menuItems}
  </Drawer>
)}

// ❌ Bad: Same navigation everywhere
<Drawer variant="permanent">
  {menuItems}
</Drawer>
```

---

## Testing Tools

### Browser DevTools

1. **Chrome DevTools**
   - F12 → Toggle device toolbar (Ctrl+Shift+M)
   - Preset devices: iPhone SE, iPhone 12 Pro, iPad, iPad Pro
   - Custom: Set width to 320px, 768px, 1024px, 1920px

2. **Firefox DevTools**
   - F12 → Responsive Design Mode (Ctrl+Shift+M)
   - Test orientation changes

3. **Safari DevTools**
   - Develop → Enter Responsive Design Mode

### Testing Script

```bash
# Test common widths
# Mobile portrait: 320px, 375px, 414px
# Tablet portrait: 768px, 834px
# Tablet landscape: 1024px
# Desktop: 1280px, 1440px, 1920px
```

### Real Device Testing

Always test on real devices:
- **Mobile**: iPhone SE (small), iPhone 12 (medium), iPhone 12 Pro Max (large)
- **Tablet**: iPad (10.2"), iPad Pro (12.9")
- **Desktop**: 13" laptop, 15" laptop, 24" monitor, 27" monitor

### Responsive Design Checklist

Create this checklist for each page:

```markdown
## Page: Daily Reports List

### Mobile (xs: 320px - 599px)
- [x] Table shows essential columns only
- [x] Action buttons use icon-only on mobile
- [x] Filters collapse into drawer
- [x] Search bar is full width
- [x] Add button is fixed at bottom

### Tablet (md: 900px - 1199px)
- [x] Table shows more columns
- [x] Filters show in top bar
- [x] Grid layout: 2 columns for cards
- [x] Sidebar can collapse

### Desktop (lg: 1200px+)
- [x] All columns visible
- [x] Permanent sidebar
- [x] Filters always visible
- [x] Grid layout: 3-4 columns
- [x] Hover effects work
```

---

## Common Responsive Patterns Summary

| Pattern | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| **Grid Cards** | 1 column | 2 columns | 3-4 columns |
| **Form Fields** | 1 column | 2 columns | 2-3 columns |
| **Navigation** | Drawer (temporary) | Drawer/Tabs | Sidebar (permanent) |
| **Table** | Scrollable/Cards | Scrollable | Full width |
| **Buttons** | Full width | Auto width | Auto width |
| **Dialog** | Full screen | Max width | Max width |
| **Spacing** | 16px (2) | 24px (3) | 32px (4) |
| **Font Size** | 14px | 16px | 16px |

---

## Utilities

### Custom Hook: useResponsive

Create a custom hook for common breakpoint checks:

```typescript
// hooks/useResponsive.ts
import { useTheme, useMediaQuery } from '@mui/material';

export const useResponsive = () => {
  const theme = useTheme();

  return {
    isMobile: useMediaQuery(theme.breakpoints.down('md')),
    isTablet: useMediaQuery(theme.breakpoints.between('md', 'lg')),
    isDesktop: useMediaQuery(theme.breakpoints.up('lg')),
    isXs: useMediaQuery(theme.breakpoints.only('xs')),
    isSm: useMediaQuery(theme.breakpoints.only('sm')),
    isMd: useMediaQuery(theme.breakpoints.only('md')),
    isLg: useMediaQuery(theme.breakpoints.only('lg')),
    isXl: useMediaQuery(theme.breakpoints.only('xl')),
  };
};

// Usage
const { isMobile, isDesktop } = useResponsive();
```

### Responsive Container Component

```typescript
// components/common/ResponsiveContainer.tsx
export const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Container
      maxWidth="xl"
      sx={{
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2, md: 3 },
      }}
    >
      {children}
    </Container>
  );
};
```

---

## References

- [Material-UI Breakpoints](https://mui.com/material-ui/customization/breakpoints/)
- [Material-UI Responsive UI](https://mui.com/material-ui/guides/responsive-ui/)
- [Material-UI useMediaQuery](https://mui.com/material-ui/react-use-media-query/)
- [Web.dev Responsive Design](https://web.dev/responsive-web-design-basics/)
