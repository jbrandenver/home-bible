import type { GetServerSidePropsContext } from 'next';

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const roomId = typeof context.params?.roomId === 'string' ? context.params.roomId : '';

  return {
    redirect: {
      destination: roomId ? `/rooms/${roomId}` : '/home-map',
      permanent: false
    }
  };
};

export default function LegacyPropertyRoomRedirect() {
  return null;
}
