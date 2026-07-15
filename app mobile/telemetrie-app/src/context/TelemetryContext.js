import React from 'react';
import { AppProvider } from './AppContext';
import { LiveProvider } from './LiveContext';
import { AlertProvider } from './AlertContext';

export const TelemetryProvider = ({ children }) => {
    return (
        <AppProvider>
            <AlertProvider>
                <LiveProvider>
                    {children}
                </LiveProvider>
            </AlertProvider>
        </AppProvider>
    );
};
