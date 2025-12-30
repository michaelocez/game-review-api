import {Express} from "express";
import {rootUrl} from "./base.routes";
import * as gameController from '../controllers/game.controller'
import * as gameReviewController from '../controllers/game.review.controller'
import * as gameActionController from '../controllers/game.action.controller'
import * as gameImageController from '../controllers/game.image.controller'


module.exports = (app: Express) => {
    app.route(rootUrl + '/games')
        .get(gameController.getAllGames)
        .post(gameController.addGame);

    app.route(rootUrl + '/games/genres')
        .get(gameController.getGenres);

    app.route(rootUrl + '/games/platforms')
        .get(gameController.getPlatforms);

    app.route(rootUrl+'/games/:id')
        .get(gameController.getGame)
        .patch(gameController.editGame)
        .delete(gameController.deleteGame);

    app.route(rootUrl + '/games/:id/reviews')
        .get(gameReviewController.getGameReviews)
        .post(gameReviewController.addGameReview);

    app.route(rootUrl + '/games/:id/wishlist')
        .post(gameActionController.addGameToWishlist)
        .delete(gameActionController.removeGameFromWishlist);

    app.route(rootUrl + '/games/:id/owned')
        .post(gameActionController.addGameToOwned)
        .delete(gameActionController.removeGameFromOwned);

    app.route(rootUrl + '/games/:id/image')
        .get(gameImageController.getImage)
        .put(gameImageController.setImage);

}