import { useEffect } from 'react';

const PRODUCT_NAME = 'Developer Knowledge Hub';

export function usePageTitle(title: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | ${PRODUCT_NAME}`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
