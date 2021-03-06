import { Section } from 'app/core/section';
import { SectionService } from 'app/core/section.service';
import { InterventionComponent } from './intervention/intervention.component';
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
// import { StateService } from 'app/core/state.service';
import { Observable, Subscription } from 'rxjs/Rx';
import { State } from 'app/core/state';
import { Quiz } from 'app/core/quiz';
import { Svg } from 'app/core/svg';
import { UserEvaluatorService } from "app/core/user-evaluator.service";
import { AuthService } from 'app/core/auth.service';
import {StarRatingComponent} from "app/player/star-rating/star-rating.component";

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.css']
})


export class PlayerComponent implements OnInit {
  @ViewChild('scroll') scrollRef: ElementRef;
  @ViewChild(InterventionComponent) intervention: InterventionComponent;
  @ViewChild(StarRatingComponent) starRating: StarRatingComponent;

  height: number;
  width: number;
  error: string;

  section: Section;
  currentState: Readonly<State>;
  contentState: Readonly<State>;
  interventionState: Readonly<State>;
  private subscription: Subscription;  // to listen to state transitions (onNext())

  menu: boolean;
  private waitingLoad: boolean = true;
  private isUserLoggedIn: boolean = false;
  private userInfo = "";
  private placesToVisit: string[] = ['sala', 'cozinha', 'banheiro', 'aservico', 'quarto 1', 'quarto 2'];

  //TODO config page: add this page to exceptions
  private loginFreeStates: string[] = ['inicio', 'aluno', 'facebook', 'menu', 'summary', 'creditos'];

  constructor(private sectionServ: SectionService, private userEvaluator: UserEvaluatorService,private authService: AuthService) {
  }

  ngOnInit() {
    this.sectionServ.current$.subscribe(section => {
      this.section = this.sectionServ.current;
      this.run();
    });
  }

  nextState() {
    console.log('current state');
    console.log(this.currentState);

    if (this.currentState && this.currentState.behavior.onNext) {

      var quiz = this.currentState.page.gadgets.find(gadget => gadget.type == 'quiz') as Quiz;
      if(quiz) {
        quiz.quizComponent.answer();
      }

      this.sectionServ.current.showNextButtonTip = false;
      this.sectionServ.current.setBlinkButton(false);
      this.currentState.behavior.onNext();
    }
  }

  private updateInternalState(state: State) {

    if (state) {
      if(this.checkLogin(state)) {
        let previousState = this.sectionServ.currentState ? this.sectionServ.currentState.label : '';
        this.sectionServ.currentState = state;
        this.currentState = state; // save the reference to call 'onNext()'
        this.sectionServ.currentState.previousState = previousState;

        // call behavior and update page elements
        if (state.behavior.onEnter) {
          state.behavior.onEnter();
        }
        state.page.update();

        console.log(State.globals);

        // set up the correct var to in the player
        if (state.type == 'content') {
          if(this.authService.getUser() != null) {

            this.isUserLoggedIn = true;
            this.userEvaluator.getScore().then(score=> {
              this.userInfo = this.authService.getUser().displayName.substring(0, 20) + " - ( " + score + " )";
            });

            this.starRating.updateStarsImage();
            if(state.label == "capa") {
               this.userEvaluator.showInstructions().then(showInstructions => {
                 if(showInstructions) {
                   this.sectionServ.currentState.goToPage("instructions");
                   this.userEvaluator.setShowInstructions(false);
                 }
               })
            } else if(this.placesToVisit.indexOf(state.label) != -1) {
              this.userEvaluator.addVisitedPlace(state.label);
            }

          } else {
            this.isUserLoggedIn = false;
            this.userInfo = "";
            this.starRating.hide();
          }
          this.contentState = state;
          this.intervention.hide();
        }
        else if (state.type == 'intervention') {
          this.interventionState = state;
          this.intervention.show();
        }
        // remove the event subscription from the previous event and creates a new one with the new event.
        if (this.subscription) {

          this.subscription.unsubscribe();
        }
        this.subscription = state.next$.subscribe(s => this.updateInternalState(s));

        this.validateQuestions();

        this.menu = (state.label == 'menu' ? true : false);

      } else {
        this.sectionServ.currentState.goToPage("inicio");
      }
    }
    else {
      // TODO the book end up in a final state
      // what to do: close the player? or show a pre-defined page
      console.log('book finished');

    }

    this.waitingLoad = false;
  }


  private validateQuestions() {
    this.userEvaluator.updateQuestions();
  }

  private checkLogin(state: State) {
    if((this.authService.getUser() == null) && !this.loginFreeStates.includes(state.label)) {
      //this.sectionServ.currentState.goToPage("inicio");
      return false;
    }

    return true;
  }

  run() {
    if (this.section) {
      let start = this.section.getInitialState();
      if (start) {
        this.section.updateStateBehaviors(); // compile
        this.updateInternalState(start);
        // this.sectionServ.save();
      }
      else {
        this.error = 'Página inicial não definida';
      }
    }
  }

}
