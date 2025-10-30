/**
 * BackButton Component
 * ปุ่มย้อนกลับพร้อม fallback path
 */

import React from 'react';
import { Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/router';

export interface BackButtonProps {
  label?: string;
  href?: string;
  sx?: object;
}

export const BackButton: React.FC<BackButtonProps> = ({
  label = 'ย้อนกลับ',
  href,
  sx,
}) => {
  const router = useRouter();

  const handleClick = () => {
    if (href) {
      router.push(href);
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <Button
      variant="text"
      startIcon={<ArrowBackIcon />}
      onClick={handleClick}
      sx={{ mb: 2, ...sx }}
    >
      {label}
    </Button>
  );
};

export default BackButton;
