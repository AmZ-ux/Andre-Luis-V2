import { Outlet, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { NotificationBell } from './NotificationBell'
import { Container } from '../ui/Container'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-secondary dark:bg-gray-950">
      <Sidebar />

      <div className="lg:ml-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-end px-4 sm:px-6 py-3 bg-secondary/80 dark:bg-gray-950/80 backdrop-blur lg:border-b lg:border-gray-100 lg:dark:border-gray-800">
          <NotificationBell />
        </header>
        <main className="flex-1 py-6 sm:py-8">
          <Container>
            <AnimatePresence mode="wait">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Container>
        </main>
        <footer className="hidden lg:block py-4 text-center border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/termos-de-uso"
              className="text-xs text-gray-400 hover:text-primary transition-colors"
            >
              Termos de Uso
            </Link>
            <span className="text-xs text-gray-300 dark:text-gray-600">|</span>
            <Link
              to="/politica-de-privacidade"
              className="text-xs text-gray-400 hover:text-primary transition-colors"
            >
              Política de Privacidade
            </Link>
          </div>
        </footer>
      </div>

      <MobileNav />
    </div>
  )
}
