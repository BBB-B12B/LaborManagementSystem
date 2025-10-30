/**
 * DC AutoComplete Component
 * คอมโพเนนต์ค้นหาแรงงานรายวัน (DC)
 *
 * Autocomplete search for Daily Contractors
 * Searches by name or employee number
 * Used in Daily Report forms (FR-DR-003, FR-DR-004)
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AutoCompleteSearch,
  AutoCompleteOption,
  createAutoCompleteOption,
} from './AutoCompleteSearch';

export interface DailyContractor {
  id: string;
  employeeId: string;
  name: string;
  skillId: string;
  skillName?: string;
  isActive: boolean;
  hourlyRate?: number;
  professionalRate?: number;
}

export interface DCAutoCompleteProps {
  label?: string;
  value?: string | string[] | null;
  onChange: (value: string | string[] | null, selected?: DailyContractor[]) => void;
  projectId?: string; // Filter DCs by project access
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean; // Support multi-select (FR-DR-004)
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

/**
 * DC AutoComplete component
 * - Searches DCs by name or employee ID
 * - Filters by project access if projectId provided (FR-DR-003)
 * - Supports single and multiple selection (FR-DR-004)
 * - Shows skill as subtitle
 * - <0.5s search response (SC-008)
 */
export const DCAutoComplete: React.FC<DCAutoCompleteProps> = ({
  label = 'แรงงานรายวัน (DC)',
  value,
  onChange,
  projectId,
  error = false,
  helperText,
  disabled = false,
  required = false,
  multiple = false,
  fullWidth = true,
  size = 'medium',
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCache, setSelectedCache] = React.useState<Record<string, DailyContractor>>({});

  /**
   * Fetch DCs from API
   * Filters by project if projectId provided
   */
  const { data: dcs = [], isLoading } = useQuery({
    queryKey: ['dailyContractors', projectId, searchTerm],
    queryFn: async () => {
      // TODO: Replace with actual API call
      // const response = await api.get('/daily-contractors', {
      //   params: {
      //     projectId,
      //     search: searchTerm,
      //     isActive: true,
      //   },
      // });
      // return response.data;

      // Mock data for development
      return [
        {
          id: 'dc1',
          employeeId: 'DC001',
          name: 'สมชาย ใจดี',
          skillId: 'skill1',
          skillName: 'ช่างไฟฟ้า',
          isActive: true,
        },
        {
          id: 'dc2',
          employeeId: 'DC002',
          name: 'สมหญิง รักงาน',
          skillId: 'skill2',
          skillName: 'ช่างก่อสร้าง',
          isActive: true,
        },
        {
          id: 'dc3',
          employeeId: 'DC003',
          name: 'สมศักดิ์ ขยัน',
          skillId: 'skill1',
          skillName: 'ช่างไฟฟ้า',
          isActive: true,
        },
      ].filter((dc) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          dc.name.toLowerCase().includes(search) ||
          dc.employeeId.toLowerCase().includes(search)
        );
      });
    },
    enabled: Boolean(projectId), // Only fetch once project selected
  });

  const createPlaceholderDC = React.useCallback(
    (id: string): DailyContractor => ({
      id,
      employeeId: id,
      name: id,
      skillId: '',
      isActive: true,
    }),
    []
  );

  /**
   * Cache fetched DCs so previously selected options remain visible even when not in current search results
   */
  React.useEffect(() => {
    if (!dcs || dcs.length === 0) return;
    setSelectedCache((prev) => {
      const next = { ...prev };
      let mutated = false;
      dcs.forEach((dc) => {
        if (!next[dc.id]) {
          mutated = true;
        } else if (next[dc.id] !== dc) {
          mutated = true;
        }
        next[dc.id] = dc;
      });
      return mutated ? next : prev;
    });
  }, [dcs]);

  /**
   * Ensure cached selections include any ids provided via controlled value (e.g., initial form values)
   */
  React.useEffect(() => {
    if (!value) return;

    const ids = Array.isArray(value) ? value : [value];
    setSelectedCache((prev) => {
      let mutated = false;
      const next = { ...prev };
      ids.forEach((id) => {
        if (id && !next[id]) {
          next[id] = createPlaceholderDC(id);
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [value, createPlaceholderDC]);

  /**
   * Helper to create autocomplete option from DC data
   */
  const createOptionFromDC = React.useCallback(
    (dc: DailyContractor): AutoCompleteOption =>
      createAutoCompleteOption(dc.id, `${dc.name} (${dc.employeeId})`, dc.skillName, {
        dc,
      }),
    []
  );

  /**
   * Convert DCs to AutoComplete options
   */
  const options: AutoCompleteOption[] = React.useMemo(() => {
    const map = new Map<string, AutoCompleteOption>();
    dcs.forEach((dc) => {
      const option = createOptionFromDC(dc);
      map.set(option.id, option);
    });

    Object.values(selectedCache).forEach((dc) => {
      if (!map.has(dc.id)) {
        map.set(dc.id, createOptionFromDC(dc));
      }
    });

    return Array.from(map.values());
  }, [dcs, selectedCache, createOptionFromDC]);

  /**
   * Convert selected value to AutoComplete option(s)
   */
  const selectedOption = React.useMemo(() => {
    const resolveDC = (id: string): DailyContractor | null => {
      if (!id) return null;
      return selectedCache[id] || null;
    };

    if (multiple) {
      if (!value) {
        return [];
      }

      const ids = Array.isArray(value) ? value : [value];
      return ids
        .map((id) => {
          const dc = resolveDC(id) ?? createPlaceholderDC(id);
          return createOptionFromDC(dc);
        }) as AutoCompleteOption[];
    }

    const id = Array.isArray(value) ? value[0] : value;
    if (!id) return null;

    const dc = resolveDC(id) ?? createPlaceholderDC(id);
    return createOptionFromDC(dc);
  }, [value, multiple, selectedCache, createOptionFromDC, createPlaceholderDC]);

  /**
   * Handle selection change
   */
  const handleChange = (selected: AutoCompleteOption | AutoCompleteOption[] | null) => {
    if (!selected) {
      onChange(multiple ? [] : null, []);
      return;
    }

    const selectedArray = Array.isArray(selected) ? selected : [selected];
    const selectedDCs = selectedArray
      .map((opt) => opt.dc as DailyContractor | undefined)
      .filter((dc): dc is DailyContractor => Boolean(dc))
      .map((dc) => (dc.employeeId ? dc : createPlaceholderDC(dc.id)));

    if (selectedDCs.length > 0) {
      setSelectedCache((prev) => {
        const next = { ...prev };
        selectedDCs.forEach((dc) => {
          next[dc.id] = dc;
        });
        return next;
      });
    }

    const ids = selectedDCs.map((dc) => dc.id);
    onChange(multiple ? ids : ids[0] ?? null, selectedDCs);
  };

  /**
   * Handle search
   */
  const handleSearch = (search: string) => {
    setSearchTerm(search);
  };

  return (
    <AutoCompleteSearch
      label={label}
      value={selectedOption}
      onChange={handleChange}
      options={options}
      loading={isLoading}
      onSearch={handleSearch}
      error={error}
      helperText={helperText || (projectId ? undefined : 'กรุณาเลือกโครงการก่อน')}
      disabled={disabled || !projectId}
      required={required}
      multiple={multiple}
      fullWidth={fullWidth}
      size={size}
      placeholder={multiple ? 'เลือกแรงงาน (สามารถเลือกได้หลายคน)' : 'ค้นหาด้วยชื่อหรือรหัสพนักงาน'}
      noOptionsText={projectId ? 'ไม่พบแรงงานรายวัน' : 'กรุณาเลือกโครงการก่อน'}
    />
  );
};

export default DCAutoComplete;
