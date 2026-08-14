import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/tournaments',
})
export class TournamentsGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    client.join(`tournament:${slug}`);
    return { event: 'joined', data: slug };
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    client.leave(`tournament:${slug}`);
    return { event: 'left', data: slug };
  }

  emitTournamentUpdate(slug: string, tournament: unknown) {
    this.server?.to(`tournament:${slug}`).emit('tournament:update', tournament);
  }

  emitBracketUpdate(slug: string, data: unknown) {
    this.server?.to(`tournament:${slug}`).emit('bracket:update', data);
  }

  emitMatchUpdate(slug: string, data: unknown) {
    this.server?.to(`tournament:${slug}`).emit('match:update', data);
  }
}
