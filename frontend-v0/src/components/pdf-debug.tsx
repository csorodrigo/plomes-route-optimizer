"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { runPDFDebugTests, testBasicPDF, testPDFDownload, testPDFWithMockData } from "@/lib/pdf-debug";

interface DebugResult {
  success: boolean;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}

export function PDFDebugPanel() {
  const [isVisible, setIsVisible] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, DebugResult>>({});
  const [isRunning, setIsRunning] = useState(false);

  const runSingleTest = async (testName: string, testFn: () => Promise<DebugResult> | DebugResult) => {
    setIsRunning(true);
    try {
      const result = await testFn();
      setTestResults(prev => ({
        ...prev,
        [testName]: result
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          message: 'Test execution failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});
    try {
      const { results } = await runPDFDebugTests();
      setTestResults(results);
    } catch (error) {
      console.error('Failed to run debug tests:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults({});
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg"
          size="sm"
        >
          🔧 PDF Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-96 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">PDF Debug Panel</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {isRunning ? "Running..." : "Run All Tests"}
          </Button>
          <Button
            onClick={clearResults}
            variant="outline"
            size="sm"
          >
            Clear
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => runSingleTest('basicPDF', testBasicPDF)}
            disabled={isRunning}
            variant="outline"
            size="sm"
          >
            Basic PDF
          </Button>
          <Button
            onClick={() => runSingleTest('downloadTest', testPDFDownload)}
            disabled={isRunning}
            variant="outline"
            size="sm"
          >
            Download Test
          </Button>
          <Button
            onClick={() => runSingleTest('mockData', testPDFWithMockData)}
            disabled={isRunning}
            variant="outline"
            size="sm"
            className="col-span-2"
          >
            Mock Data PDF
          </Button>
        </div>

        {Object.keys(testResults).length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            <h4 className="text-sm font-medium text-gray-700">Test Results:</h4>
            {Object.entries(testResults).map(([testName, result]) => (
              <div
                key={testName}
                className={`p-2 rounded text-xs border ${
                  result.success
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <div className="font-medium">
                  {result.success ? '✅' : '❌'} {testName}
                </div>
                <div className="mt-1">{result.message}</div>
                {result.error && (
                  <div className="mt-1 text-red-600 text-xs">Error: {result.error}</div>
                )}
                {result.details && (
                  <div className="mt-1 text-gray-600 text-xs">
                    {Object.entries(result.details).map(([key, value]) => (
                      <div key={key}>
                        {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          <p>This debug panel helps identify PDF export issues.</p>
          <p>Check browser console for detailed logs.</p>
        </div>
      </div>
    </div>
  );
}