import React, { useState } from 'react';

export const AnalogTimePicker = ({
    value,
    onChange,
    onClose
}: {
    value: string;
    onChange: (time: string) => void;
    onClose: () => void;
}) => {
    const [currentTime, setCurrentTime] = useState(value);

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3>Mock Time Picker</h3>
                <input 
                    type="time" 
                    value={currentTime} 
                    onChange={(e) => setCurrentTime(e.target.value)} 
                    style={{ padding: '10px', fontSize: '1.2rem' }}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '10px' }}>Cancel</button>
                    <button onClick={() => { onChange(currentTime); onClose(); }} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: '#fff', border: 'none' }}>Set Time</button>
                </div>
            </div>
        </div>
    );
};
