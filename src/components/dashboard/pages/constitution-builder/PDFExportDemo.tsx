import React, { useState } from 'react';
import {
    Download,
    Zap,
    Settings,
    CheckCircle,
    AlertCircle,
    Monitor,
    Image,
    Palette,
    Clock,
    MemoryStick
} from 'lucide-react';
import { exportConstitutionToEnhancedPDF, getOptimalExportOptions, type EnhancedPDFExportOptions } from './utils/enhancedPdfExport';
import { exportConstitutionToPDF } from './utils/pdfExportUtils';
import type { Constitution, ConstitutionSection } from '../../shar../../shared/types/firestore';

interface PDFExportDemoProps {
    constitution: Constitution | null;
    sections: ConstitutionSection[];
}

const PDFExportDemo: React.FC<PDFExportDemoProps> = ({
    constitution,
    sections
}) => {
    const [exportProgress, setExportProgress] = useState<{ progress: number; status: string } | null>(null);
    const [lastExportTime, setLastExportTime] = useState<number | null>(null);
    const [exportMethod, setExportMethod] = useState<'standard' | 'enhanced'>('enhanced');
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [exportOptions, setExportOptions] = useState<Partial<EnhancedPDFExportOptions>>({
        quality: 1.0,
        scale: 3,
        dpi: 300,
        captureMethod: 'canvas',
        preserveFonts: true,
        optimizeImages: true,
        enableAntialiasing: true,
        memoryLimit: 512
    });

    const handleExport = async () => {
        const startTime = Date.now();

        try {
            setExportProgress({ progress: 0, status: 'Preparing export...' });

            if (exportMethod === 'enhanced') {
                // Get optimal options and merge with user preferences
                const optimalOptions = await getOptimalExportOptions();
                const finalOptions = { ...exportOptions, ...optimalOptions };

                await exportConstitutionToEnhancedPDF(
                    constitution,
                    sections,
                    finalOptions,
                    (progress, status) => {
                        setExportProgress({ progress, status });
                    }
                );
            } else {
                await exportConstitutionToPDF(
                    constitution,
                    sections,
                    {
                        quality: exportOptions.quality || 1.0,
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff'
                    },
                    (progress, status) => {
                        setExportProgress({ progress, status });
                    }
                );
            }

            const endTime = Date.now();
            setLastExportTime(endTime - startTime);

            // Clear progress after delay
            setTimeout(() => {
                setExportProgress(null);
            }, 2000);

        } catch (error) {
            console.error('Export failed:', error);
            setExportProgress({ progress: 0, status: 'Export failed. Please try again.' });

            setTimeout(() => {
                setExportProgress(null);
            }, 3000);
        }
    };

    const features = {
        enhanced: [
            { icon: Zap, label: 'Native screen capture API', status: 'getDisplayMedia' in navigator.mediaDevices },
            { icon: Monitor, label: 'Automatic boundary detection', status: true },
            { icon: Image, label: 'High-resolution output (300 DPI)', status: true },
            { icon: Palette, label: 'Advanced anti-aliasing', status: true },
            { icon: CheckCircle, label: 'Font preservation', status: 'fonts' in document },
            { icon: MemoryStick, label: 'Memory optimization', status: true }
        ],
        standard: [
            { icon: Settings, label: 'HTML-to-PDF conversion', status: true },
            { icon: Image, label: 'Standard resolution (96 DPI)', status: true },
            { icon: CheckCircle, label: 'Basic font support', status: true }
        ]
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    PDF Export System Demo
                </h3>
                <p className="text-gray-600 text-sm">
                    Test and compare the enhanced PDF export system with pixel-perfect capture capabilities.
                </p>
            </div>

            {/* Export Method Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Export Method
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${exportMethod === 'enhanced'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                        onClick={() => setExportMethod('enhanced')}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <Zap className="h-5 w-5 text-yellow-500" />
                            <span className="font-medium">Enhanced Capture</span>
                            {exportMethod === 'enhanced' && <CheckCircle className="h-4 w-4 text-blue-500 ml-auto" />}
                        </div>

                        <div className="space-y-2">
                            {features.enhanced.map((feature, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                    <feature.icon className={`h-3 w-3 ${feature.status ? 'text-green-500' : 'text-gray-400'}`} />
                                    <span className={feature.status ? 'text-gray-700' : 'text-gray-400'}>
                                        {feature.label}
                                    </span>
                                    {!feature.status && <AlertCircle className="h-3 w-3 text-amber-500" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${exportMethod === 'standard'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                        onClick={() => setExportMethod('standard')}
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <Settings className="h-5 w-5 text-gray-500" />
                            <span className="font-medium">Standard Export</span>
                            {exportMethod === 'standard' && <CheckCircle className="h-4 w-4 text-blue-500 ml-auto" />}
                        </div>

                        <div className="space-y-2">
                            {features.standard.map((feature, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                    <feature.icon className={`h-3 w-3 ${feature.status ? 'text-green-500' : 'text-gray-400'}`} />
                                    <span className={feature.status ? 'text-gray-700' : 'text-gray-400'}>
                                        {feature.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Advanced Options */}
            {exportMethod === 'enhanced' && (
                <div className="mb-6">
                    <button
                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                        <Settings className="h-4 w-4" />
                        Advanced Options
                    </button>

                    {showAdvancedOptions && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Quality (0.1 - 1.0)
                                    </label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1.0"
                                        step="0.1"
                                        value={exportOptions.quality || 1.0}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, quality: parseFloat(e.target.value) }))}
                                        className="w-full"
                                    />
                                    <span className="text-xs text-gray-500">{exportOptions.quality}</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Scale (1x - 4x)
                                    </label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="4"
                                        step="1"
                                        value={exportOptions.scale || 3}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, scale: parseInt(e.target.value) }))}
                                        className="w-full"
                                    />
                                    <span className="text-xs text-gray-500">{exportOptions.scale}x</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        DPI
                                    </label>
                                    <select
                                        value={exportOptions.dpi || 300}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, dpi: parseInt(e.target.value) }))}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    >
                                        <option value={150}>150 DPI (Draft)</option>
                                        <option value={300}>300 DPI (Print)</option>
                                        <option value={600}>600 DPI (High Quality)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Capture Method
                                    </label>
                                    <select
                                        value={exportOptions.captureMethod || 'canvas'}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, captureMethod: e.target.value as any }))}
                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                    >
                                        <option value="canvas">Canvas Rendering (Recommended)</option>
                                        <option value="hybrid">Enhanced Canvas</option>
                                        <option value="screen">Screen Capture (Requires Permission)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={exportOptions.preserveFonts || false}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, preserveFonts: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-xs text-gray-700">Preserve Fonts</span>
                                </label>

                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={exportOptions.optimizeImages || false}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, optimizeImages: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-xs text-gray-700">Optimize Images</span>
                                </label>

                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={exportOptions.enableAntialiasing || false}
                                        onChange={(e) => setExportOptions(prev => ({ ...prev, enableAntialiasing: e.target.checked }))}
                                        className="rounded"
                                    />
                                    <span className="text-xs text-gray-700">Anti-aliasing</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Export Progress */}
            {exportProgress ? (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
                        <span className="text-sm font-medium text-blue-700">{exportProgress.status}</span>
                    </div>

                    {exportProgress.progress > 0 && (
                        <div className="space-y-2">
                            <div className="w-full bg-blue-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${exportProgress.progress}%` }}
                                />
                            </div>
                            <div className="text-xs text-blue-600 text-right">
                                {Math.round(exportProgress.progress)}%
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mb-6">
                    <button
                        onClick={handleExport}
                        disabled={!constitution || sections.length === 0}
                        className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${exportMethod === 'enhanced'
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                            : 'bg-gray-600 text-white hover:bg-gray-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                    >
                        <Download className="h-4 w-4" />
                        Export PDF with {exportMethod === 'enhanced' ? 'Enhanced' : 'Standard'} Quality
                        {exportMethod === 'enhanced' && <Zap className="h-3 w-3 text-yellow-300" />}
                    </button>
                </div>
            )}

            {/* Performance Stats */}
            {lastExportTime && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">Export completed successfully!</span>
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                        Export time: {(lastExportTime / 1000).toFixed(2)} seconds using {exportMethod} method
                    </div>
                </div>
            )}

            {/* Help Text */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-sm">
                    <strong className="text-amber-800">Tips for best results:</strong>
                    <ul className="mt-2 space-y-1 text-amber-700 text-xs">
                        <li>• Enhanced capture provides pixel-perfect quality without permissions</li>
                        <li>• Ensure preview is fully loaded before exporting</li>
                        <li>• Higher scale values improve quality but increase file size</li>
                        <li>• Canvas rendering works without user permissions</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default PDFExportDemo; 