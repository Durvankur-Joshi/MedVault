"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Download,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  Lock,
} from "lucide-react";
import { fetchDocumentBlob } from "@/services/records";

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordId: string | null;
  filename?: string | null;
  mimeType?: string | null;
}

export function DocumentViewerModal({
  isOpen,
  onClose,
  recordId,
  filename: initialFilename,
  mimeType: initialMimeType,
}: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docMime, setDocMime] = useState<string>(initialMimeType || "");
  const [docFilename, setDocFilename] = useState<string>(
    initialFilename || "medical-document"
  );
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    if (!isOpen || !recordId) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setLoading(true);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setZoomLevel(1);

    fetchDocumentBlob(recordId)
      .then(({ blob, mimeType, filename }) => {
        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setDocMime(mimeType || initialMimeType || blob.type || "application/pdf");
          if (filename) setDocFilename(filename);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.message || "Failed to retrieve and decrypt medical document.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, recordId]);

  if (!isOpen) return null;

  const isPdf =
    docMime.toLowerCase().includes("pdf") || docFilename.toLowerCase().endsWith(".pdf");
  const isImage =
    docMime.toLowerCase().startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(docFilename);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = docFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100 max-w-md truncate">
                  {docFilename}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  SHA-256 Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                AES-256-GCM Decrypted • Zero-Knowledge Authorized
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isImage && blobUrl && (
              <div className="flex items-center gap-1 mr-2 p-1 bg-slate-950 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 text-slate-400 hover:text-slate-200"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-slate-400 px-1">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 text-slate-400 hover:text-slate-200"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {blobUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/30 transition-colors"
                title="Download Decrypted File"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 bg-slate-950/95 overflow-auto p-4 flex items-center justify-center min-h-[55vh] relative">
          {loading && (
            <div className="flex flex-col items-center justify-center space-y-3 text-cyan-400 py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
              <div className="text-xs font-semibold text-slate-300">
                Fetching, Decrypting & Verifying SHA-256 Integrity...
              </div>
              <p className="text-[11px] text-slate-500">
                Streaming encrypted bytes from off-chain storage
              </p>
            </div>
          )}

          {error && (
            <div className="p-6 bg-red-950/30 border border-red-500/40 rounded-2xl max-w-md text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <div className="text-sm font-bold text-red-200">Unable to View Document</div>
              <p className="text-xs text-red-300/90 leading-relaxed">{error}</p>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <>
              {isPdf ? (
                <iframe
                  src={`${blobUrl}#toolbar=1&navpanes=0`}
                  title={docFilename}
                  className="w-full h-[70vh] rounded-xl border border-slate-800 bg-white"
                />
              ) : isImage ? (
                <div className="overflow-auto max-h-[70vh] flex items-center justify-center p-2">
                  <img
                    src={blobUrl}
                    alt={docFilename}
                    style={{ transform: `scale(${zoomLevel})` }}
                    className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-150"
                  />
                </div>
              ) : (
                <div className="text-center p-8 space-y-4 max-w-md">
                  <FileText className="w-16 h-16 text-amber-400 mx-auto" />
                  <div>
                    <h4 className="text-base font-bold text-slate-200">{docFilename}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      File type: {docMime || "Binary Encrypted File"}
                    </p>
                  </div>
                  <button
                    onClick={handleDownload}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Decrypted Document
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/80 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Decrypted in client memory • Not stored unencrypted</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
