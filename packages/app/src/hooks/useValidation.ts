import { useState } from 'react';

export const useValidation = () => {
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const setError = (key: string, message: string) => {
    setErrors((prevErrors) => ({ ...prevErrors, [key]: message }));
  };

  const clearError = (key: string) => {
    setErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      delete newErrors[key];
      return newErrors;
    });
  };

  const clearAllErrors = () => {
    setErrors({});
  };

  return {
    errors,
    setError,
    clearError,
    clearAllErrors,
  };
};
