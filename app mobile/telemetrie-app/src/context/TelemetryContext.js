import React from 'react';

/**
 * TelemetryProvider — Păstrat pentru compatibilitate cu importurile legacy.
 * Toți Providerii reali (App, Notification, Alert, Live) sunt montați
 * o singură dată în mod liniar în App.js pentru a preveni dublarea listenerilor.
 */
export const TelemetryProvider = ({ children }) => <>{children}</>;

export default TelemetryProvider;
