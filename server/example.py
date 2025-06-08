from music_gen_server.server import MusicGenServer

server = MusicGenServer()
server.run('localhost', 8000)