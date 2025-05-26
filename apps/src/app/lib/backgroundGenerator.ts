export async function backgroundGenerator(RoomCode: number, prompt: string) {
  try {
    const response = await fetch(`http://127.0.0.1:8000/api/world/games/${RoomCode}/background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error details:', errorData);
      const detail = Array.isArray(errorData.detail)
        ? errorData.detail.map((d: any) => `${d.loc.join('.')} - ${d.msg}`).join('; ')
        : errorData.detail;
      throw new Error(`Error ${response.status}: ${detail || response.statusText}`);
    }

    const data = await response.json();
    console.log('Background generated:', data.background);
    return data.background;
  } catch (error) {
    console.error('Error generating background:', error);
    throw error;
  }
}
