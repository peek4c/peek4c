/**
 * Global Error Handler
 * Captures and logs crashes to help diagnose OOM and other issues
 */

import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler';
import * as FileSystem from 'expo-file-system/legacy';

let isReportingError = false;

const errorHandler = (error: Error, isFatal: boolean) => {
    if (isReportingError) return;
    isReportingError = true;

    const timestamp = new Date().toISOString();
    const errorLog = `
=== CRASH LOG ===
Time: ${timestamp}
Fatal: ${isFatal}
Error: ${error.name}
Message: ${error.message}
Stack: ${error.stack}
================
`;

    // Use console.log to avoid triggering the handler again if it hooks console.error
    console.log('[CrashHandler]', errorLog);

    // Save to file
    const logPath = `${FileSystem.documentDirectory}crash_logs.txt`;
    FileSystem.readAsStringAsync(logPath)
        .catch(() => '')
        .then(existingLogs => {
            const newLogs = existingLogs + errorLog;
            return FileSystem.writeAsStringAsync(logPath, newLogs);
        })
        .then(() => {
            console.log('[CrashHandler] Crash log saved to:', logPath);
        })
        .catch(err => {
            console.log('[CrashHandler] Failed to save crash log:', err);
        })
        .finally(() => {
            isReportingError = false;
        });
};

// Set JS exception handler
setJSExceptionHandler((error, isFatal) => {
    errorHandler(error, isFatal);
}, true);

// Set native exception handler
setNativeExceptionHandler((errorString) => {
    const timestamp = new Date().toISOString();
    const errorLog = `
=== NATIVE CRASH LOG ===
Time: ${timestamp}
Error: ${errorString}
=======================
`;

    console.error('[CrashHandler] Native crash:', errorLog);

    // Save to file
    const logPath = `${FileSystem.documentDirectory}crash_logs.txt`;
    FileSystem.readAsStringAsync(logPath)
        .catch(() => '')
        .then(existingLogs => {
            const newLogs = existingLogs + errorLog;
            return FileSystem.writeAsStringAsync(logPath, newLogs);
        })
        .catch(err => {
            console.error('[CrashHandler] Failed to save native crash log:', err);
        });
}, true, true);

export const getCrashLogs = async (): Promise<string> => {
    try {
        const logPath = `${FileSystem.documentDirectory}crash_logs.txt`;
        const logs = await FileSystem.readAsStringAsync(logPath);
        return logs;
    } catch (error) {
        return 'No crash logs found';
    }
};

export const clearCrashLogs = async (): Promise<void> => {
    try {
        const logPath = `${FileSystem.documentDirectory}crash_logs.txt`;
        await FileSystem.deleteAsync(logPath, { idempotent: true });
        console.log('[CrashHandler] Crash logs cleared');
    } catch (error) {
        console.error('[CrashHandler] Failed to clear crash logs:', error);
    }
};
