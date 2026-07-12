import { useNavigate } from 'react-router-dom'
import RenameMegaModal from '../components/RenameMegaModal'

// Route temporanea di debug per validare RenameMegaModal in isolamento,
// prima di collegarla a SearchPage (vedi piano redesign B2/B3).
export default function DebugRenameMegaModalPage({ auth }) {
  const navigate = useNavigate()
  return <RenameMegaModal auth={auth} initialSelection={null} onClose={() => navigate('/search')} />
}
