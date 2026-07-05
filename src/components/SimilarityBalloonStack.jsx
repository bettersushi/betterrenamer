import { useLocation, useNavigate } from 'react-router-dom'
import { useSimilarity } from '../context/SimilarityContext'
import SimilarityBalloon from './SimilarityBalloon'

export default function SimilarityBalloonStack() {
  const { balloons, removeBalloon, viewResults } = useSimilarity()
  const location = useLocation()
  const navigate = useNavigate()

  if (balloons.length === 0) return null

  return (
    <>
      {balloons.map((b, i) => (
        <SimilarityBalloon
          key={b.id}
          state={b}
          index={i}
          onViewResults={() => {
            viewResults(b.refPhoto, b.results)
            removeBalloon(b.id)
            if (location.pathname !== '/search') navigate('/search')
          }}
          onCancel={() => { b.abortRef.cancelled = true; removeBalloon(b.id) }}
          onClose={() => removeBalloon(b.id)}
        />
      ))}
    </>
  )
}
