import React from 'react';
import { AppProvider } from './AppContext';
import { LiveProvider } from './LiveContext';
import { AlertProvider } from './AlertContext';
import { NotificationProvider } from './NotificationContext';

export const TelemetryProvider = ({ children }) => {
    return (
        <AppProvider>
            <NotificationProvider>
                <AlertProvider>
                    <LiveProvider>
                        {children}
                    </LiveProvider>
                </AlertProvider>
            </NotificationProvider>
        </AppProvider>
    );
};
