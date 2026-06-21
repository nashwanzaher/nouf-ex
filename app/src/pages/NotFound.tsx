import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-8xl font-bold text-aliOrange mb-4">404</div>
      <h1 className="text-2xl font-semibold text-aliText mb-2">
        {t('errors.notFound.title', 'Page not found')}
      </h1>
      <p className="text-aliTextSec mb-8 max-w-md">
        {t('errors.notFound.desc', 'The page you are looking for does not exist or has been moved.')}
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-aliOrange text-white rounded-lg hover:bg-aliOrangeHover transition-colors"
      >
        <Home className="w-4 h-4" />
        {t('common.backToHome', 'Back to home')}
      </Link>
    </div>
  );
}
