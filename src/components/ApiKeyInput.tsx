'use client';

import React, { useState, useEffect } from 'react';

interface ApiKeyInputProps {
  onApiKeyChange: (apiKey: string) => void;
}

export default function ApiKeyInput({ onApiKeyChange }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  useEffect(() => {
    // Try to load API key from localStorage on component mount
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      onApiKeyChange(savedApiKey);
      setIsSaved(true);
    }
  }, [onApiKeyChange]);
  
  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey);
      onApiKeyChange(apiKey);
      setIsSaved(true);
      
      // Reset the "saved" status after a moment
      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    }
  };
  
  return (
    <div className="mb-6 p-4 bg-card rounded-lg border border-border">
      <h2 className="text-lg font-semibold mb-2">OpenAI API Settings</h2>
      <p className="text-sm text-muted mb-4">
        Enter your OpenAI API key to enable transcription. 
        Your key is stored locally in your browser and never sent to our servers.
      </p>
      
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <input
            type={isVisible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setApiKey(e.target.value);
              setIsSaved(false);
            }}
            placeholder="sk-..."
            className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted hover:text-foreground"
          >
            {isVisible ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        
        <button
          onClick={handleSaveApiKey}
          disabled={!apiKey.trim() || isSaved}
          className="btn btn-primary whitespace-nowrap"
        >
          {isSaved ? (
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          ) : (
            'Save Key'
          )}
        </button>
      </div>
      
      <p className="text-xs text-muted mt-2">
        Don't have an API key? <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get one from OpenAI</a>
      </p>
    </div>
  );
}
