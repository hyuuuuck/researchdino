const roomSceneGroups = [
  {
    kicker: "Read",
    title: "Reading Bench",
    image: "/brand/room-scenes/reading-bench-strip.png",
  },
  {
    kicker: "Debate",
    title: "Debate Room",
    image: "/brand/room-scenes/debate-room-strip.png",
  },
  {
    kicker: "Strategy",
    title: "Strategy Room",
    image: "/brand/room-scenes/strategy-room-strip.png",
  },
  {
    kicker: "Experiment",
    title: "Experiment Bay",
    image: "/brand/room-scenes/experiment-bay-strip.png",
  },
] as const;

const sceneTypes = ["Type 01", "Type 02", "Type 03"] as const;
const cropClasses = ["room-scene-tile--one", "room-scene-tile--two", "room-scene-tile--three"] as const;

export function RoomSceneGallery() {
  return (
    <section className="room-scene-gallery" aria-label="Core room scene types">
      <div className="room-scene-gallery__header">
        <span className="panel-kicker">Core Rooms</span>
        <h2>Room Scene Types</h2>
      </div>
      <div className="room-scene-gallery__grid">
        {roomSceneGroups.map((room) => (
          <section className="room-scene-group" key={room.title}>
            <div className="room-scene-group__heading">
              <span>{room.kicker}</span>
              <h3>{room.title}</h3>
            </div>
            <div className="room-scene-tiles">
              {sceneTypes.map((label, index) => (
                <figure className={`room-scene-tile ${cropClasses[index]}`} key={`${room.title}-${label}`}>
                  <img src={room.image} alt="" aria-hidden="true" />
                  <figcaption>{label}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
