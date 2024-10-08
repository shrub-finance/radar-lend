import React from 'react';

interface ErrorDisplayProps {
  errors: { [key: string]: string };
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ errors }) => {
  return (
    <>
      {Object.values(errors).map((error, index) => (
        <p key={index} className='mt-2 text-sm text-red-600'>{error}</p>
      ))}
    </>
  );
};

export default ErrorDisplay;
