const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/**/*.{tsx,jsx}', { nodir: true });

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Pattern to fix existing wrappers holding
    // <table className="..."
    
    // We can replace known wrapper classes directly before a table
    const wrapperPatterns = [
        '<div className="overflow-x-auto">\\s*<table',
        '<div className="overflow-x-auto flex-1">\\s*<table',
        '<div className="overflow-y-auto flex-1">\\s*<table',
        '<div className="overflow-x-auto w-full">\\s*<table',
        '<div className="overflow-y-auto max-h-\\[400px\\]">\\s*\{[^\n]+\\s*<table'
    ];

    content = content.replace(
      /(<div className=")(overflow-[xy]-auto[^"]*)("\s*(?:>|onClick|id|style|\{))/g,
      (match, p1, p2, p3) => {
          // If it already has max-w-[100vw], ignore
          if (p2.includes('max-w-[100vw]')) return match;
          
          let newClasses = p2 + ' w-full max-w-[100vw] shadow-sm rounded-lg';
          // deduplicate w-full
          newClasses = Array.from(new Set(newClasses.split(' '))).join(' ');
          
          return p1 + newClasses + p3;
      }
    );

    // Some tables might not have an overflow wrapper at all.
    // If not, wrap them? Our grep showed most *are* wrapped.
    // Let's just do the above replace, which hits all overflow-x-auto and overflow-y-auto elements that contain tables (most do or they are the table wrapper).
    
    // As for the PublicEvaluationRequest grid replacement:
    // "Nos formulários (como o PublicEvaluationRequest.tsx), certifique-se de que os grids estão responsivos. Eles devem ter uma coluna no mobile e duas ou mais apenas a partir de telas médias: <div className="grid grid-cols-1 md:grid-cols-2 gap-4">."
    content = content.replace(
      /<div className="grid grid-cols-2 gap-4">/g,
      '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">'
    );
    // some might have gap-6
    content = content.replace(
      /<div className="grid grid-cols-2 gap-6">/g,
      '<div className="grid grid-cols-1 md:grid-cols-2 gap-6">'
    );
    // some might have grid-cols-3
    content = content.replace(
      /<div className="grid grid-cols-3 gap-6">/g,
      '<div className="grid grid-cols-1 md:grid-cols-3 gap-6">'
    );

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
});
